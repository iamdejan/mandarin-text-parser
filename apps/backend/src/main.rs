use std::env;

use axum::{
    Json, Router,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tower_http::cors::CorsLayer;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    let app = Router::new()
        .route("/healthcheck", get(health_check))
        .route("/text/parse", post(parse_text))
        .layer(CorsLayer::permissive());

    let port = env::var("PORT").unwrap_or_else(|_| return "3000".to_string());
    let host = env::var("HOST").unwrap_or_else(|_| return "127.0.0.1".to_string());

    let address = format!("{host}:{port}");
    let listener = tokio::net::TcpListener::bind(&address).await.unwrap();
    println!("Listening on http://{address}");
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> Json<Value> {
    return Json(json!({"status": "ok", "message": "Axum backend is running!"}));
}

#[derive(Serialize, Deserialize)]
struct ParseTextRequest {
    text: String,
}

#[derive(Serialize, Deserialize)]
struct Word {
    hanzi: String,
    pinyin: String,
    english: String,
}

#[derive(Serialize, Deserialize)]
struct ParseTextResponse {
    words: Vec<Word>,
}

#[derive(Debug)]
enum AppError {
    /// The external `OpenRouter` API rejected the request or encountered an
    /// internal failure. The wrapped status code is the upstream HTTP code.
    OpenRouter {
        status: StatusCode,
        message: String,
        code: i32,
        metadata: Option<Value>,
    },
    /// A well-formed HTTP response was received but the body could not be
    /// deserialized. This typically indicates a schema mismatch between the
    /// server and our `ChatCompletionResponse` / `PickSupervisorResponse`
    /// structs.
    Deserialization { context: String, detail: String },
    /// The LLM returned a message with zero choices, which is a provider edge
    /// case but not a parse error.
    EmptyChoices,
    /// Any other internal failure with no upstream HTTP status to reflect.
    Internal(String),
}

/// Converts every `AppError` variant into an Axum HTTP response with an
/// appropriate status code and a JSON-encoded error payload.
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, body) = match self {
            // Forward the upstream status code along with the structured error so
            // the client can react differently to 400 vs 429 vs 502, etc.
            AppError::OpenRouter {
                status,
                message,
                code,
                metadata,
            } => {
                let mut error_body = json!({
                    "error": {
                        "message": message,
                        "code": code
                    }
                });
                if let Some(meta) = metadata {
                    error_body["error"]["metadata"] = meta;
                }
                (status, error_body)
            }
            // Deserialization failures are *our* bug or a provider API change —
            // the frontend should treat them as an internal server error.
            AppError::Deserialization { context, detail } => {
                let error_body = json!({
                    "error": {
                        "message": format!("failed to deserialize {context}: {detail}")
                    }
                });
                (StatusCode::INTERNAL_SERVER_ERROR, error_body)
            }
            AppError::EmptyChoices => {
                let error_body = json!({
                    "error": {
                        "message": "LLM returned zero choices — upstream may have blocked the response"
                    }
                });
                (StatusCode::INTERNAL_SERVER_ERROR, error_body)
            }
            AppError::Internal(detail) => {
                let error_body = json!({
                    "error": {
                        "message": detail
                    }
                });
                (StatusCode::INTERNAL_SERVER_ERROR, error_body)
            }
        };

        let body_str = serde_json::to_string(&body).unwrap_or_else(|_| {
            return r#"{"error":{"message":"failed to serialize error response"}}"#.to_string();
        });
        return (status, body_str).into_response();
    }
}

static PROMPT_TEMPLATE: &str = r#"
You are an expert in Mandarin and English, with over 20 years of experience. Now, you are here to help me learn reading Chinese characters by parsing the given text. Parse the given text into logical words, so that I can learn how to group the characters into words. STRICTLY return the response following the format from this JSON schema: {response_schema}.

The given text:
{text}

I've included some examples to help you.

Example 1 (simple sentence):
Input:
我爱你

Output:
{"words":[{"hanzi":"我","pinyin":"wǒ","english":"I or me"},{"hanzi":"爱","pinyin":"ài","english":"love"},{"hanzi":"你","pinyin":"nǐ","english":"you"}]}

Some explanations for this example:
- 我 (wǒ) acts as a subject, and it stands alone.
- 爱 (ài) acts as a verb, and it stands alone.
- 你 (nǐ) acts as an object, and it stands alone.

Example 2 (simple sentence, with punctuations):
Input:
哎呀，我的钱包不见。

Output:
{"words":[{"hanzi":"哎呀","pinyin":"āiyā","english":"Interjection of wonder, shock or admiration"},{"hanzi":"我","pinyin":"wǒ","english":"I / me"},{"hanzi":"的","pinyin":"de","english":"of; ~'s (possessive particle)"},{"hanzi":"钱包","pinyin":"qiánbāo","english":"purse / wallet"},{"hanzi":"不见","pinyin":"bùjiàn","english":"to have disappeared / to be missing"},{"hanzi":"了","pinyin":"le","english":"(completed action marker) / (modal particle indicating change of state, situation now)"}]}

Some explanations for this example:
- 哎呀 (āiyā) is grouped as 1 word, because it is. Reading the sentence as 哎 (āi) and 呀 (yā) separately doesn't make any sense in this context.
- 我 (wǒ) acts as a subject, and it stands alone.
- 钱包 (qiánbāo) is grouped as 1 word, because the English meaning is "wallet". It is possible to group it separately, but I want to understand the character grouping (that forms a word).
- 不见 (bùjiàn) is grouped as 1 word, even though 不 (bù) acts as a negation of a verb or a state. The reason is because 不见 (bùjiàn), when translated to English, means "disappear", so the English translation of 不见 (bùjiàn) is "gone" (e.g. in this sentence, "Haiya, my wallet is gone."). Also, even though the translation can also mean "not to see / not to meet", but in this sentence the meaning is "to disappear."

Example 3 (a paragraph):
Input:
我的考试是在二零二六年六月二十日。我很害怕了，因为我没有读书。

Output:
{"words":[{"hanzi":"我","pinyin":"wǒ","english":"I / me"},{"hanzi":"的","pinyin":"de","english":"of; ~'s (possessive particle)"},{"hanzi":"考试","pinyin":"kǎoshì","english":"to take an exam / exam"},{"hanzi":"是","pinyin":"shì","english":"to be (followed by substantives only)"},{"hanzi":"在","pinyin":"zài","english":"to exist; to be alive / (of sb or sth) to be (located) at"},{"hanzi":"二零二六年","pinyin":"èrlíngèrliù nián","english":"year 2026"},{"hanzi":"六月","pinyin":"liù yuè","english":"June"},{"hanzi":"二十日","pinyin":"èrshí rì","english":"20th of (used for date)"},{"hanzi":"。","pinyin":".","english":"."},{"hanzi":"我","pinyin":"wǒ","english":"I / me"},{"hanzi":"很","pinyin":"hěn","english":"I / me"},{"hanzi":"害怕","pinyin":"hàipà","english":"to be afraid; to be scared"},{"hanzi":"了","pinyin":"le","english":"(completed action marker) / (modal particle indicating change of state, situation now)"},{"hanzi":"，","pinyin":",","english":","},{"hanzi":"因为","pinyin":"yīnwèi","english":"because"},{"hanzi":"我","pinyin":"wǒ","english":"I / me"},{"hanzi":"没有","pinyin":"méiyǒu","english":"haven't / hasn't"},{"hanzi":"读书","pinyin":"dúshū","english":"to study"}]}

Some explanations for this example:
- 我 (wǒ) acts as a subject, and it stands alone.
- 考试 (kǎoshì) is grouped as 1 word, because it is. The meaning of 考试 (kǎoshì) according to dictionary is "exam."
- The pinyin of 二零二六年 is "èrlíngèrliù nián" because "èrlíngèrliù" means "2026" and "nián" means year. By separating the pinyin with a space, I can read the pinyin as "year of 2026", as "èrlíngèrliùnián" is quite hard for me to read.
- The pinyin of 六月 is "liù yuè" because I want to make the pinyin easier for me to read. By separating the number and the period marker (yuè, month) with space, it's easier for me to read.
- 没有 (méiyǒu) can be translated into "don't have", but in this text it behaves more like "haven't" or "hasn't".
- 读书 (dúshū) has several meanings, including "to read a book" or "to study". In the context of the text, it's more relevant to translate 读书 (dúshū) to "to study."

Example 4 (a sentence with a mix of Chinese words and English words):
Input:
在fail的边缘啊啊啊啊哭了 算了我尽力了

Output:
{"words":[{"hanzi":"在","pinyin":"zài","english":"to exist; to be alive / (of sb or sth) to be (located) at"},{"hanzi":"fail","pinyin":"fail","english":"fail"},{"hanzi":"的","pinyin":"de","english":"of; ~'s (possessive particle)"},{"hanzi":"边缘","pinyin":"biānyuán","english":"edge / brink"},{"hanzi":"啊","pinyin":"ā","english":"interjection of surprise / Ah! / Oh!"},{"hanzi":"啊","pinyin":"ā","english":"interjection of surprise / Ah! / Oh!"},{"hanzi":"啊","pinyin":"ā","english":"interjection of surprise / Ah! / Oh!"},{"hanzi":"啊","pinyin":"ā","english":"interjection of surprise / Ah! / Oh!"},{"hanzi":"哭","pinyin":"kū","english":"to cry; to weep"},{"hanzi":" ","pinyin":" ","english":" "},{"hanzi":"算了","pinyin":"suànle","english":"let it be / let it pass / forget about it"},{"hanzi":"我","pinyin":"wǒ","english":"I / me"},{"hanzi":"尽力","pinyin":"jìnlì","english":"to strive one's hardest"},{"hanzi":"了","pinyin":"le","english":"(completed action marker) / (modal particle indicating change of state, situation now)"}]}

Some explanations for this example:
- For English word, the field `hanzi` and `pinyin` are filled with the English word.
- 边缘 (biānyuán) is grouped as 1 word, because it is. The meaning of 边缘 (biānyuán) according to dictionary is "edge" or "brink", which fits in this context (at the edge of fail).
- 哭 (kū) stands alone as a verb, because the meaning is "crying."
- 了 (le) after 哭 (kū) stands alone, because in this context the meaning is "completely". Combined with 哭 (kū) previously, the meaning is "completely crying."
- 算了 (suànle) here is grouped as a word, because according to dictionary 算了 (suànle) means "let it be" or "forget about it."
- 我 (wǒ) acts as a subject, and it stands alone.
- 尽力 (jìnlì) is grouped as 1 word, because it is. The meaning according to dictionary is "to strive one's hardest."
"#;

#[derive(Serialize, Deserialize)]
struct ChatCompletionMessage {
    pub content: String,
    pub role: String,
}

#[derive(Serialize, Deserialize)]
struct ChatCompletionChoice {
    pub message: ChatCompletionMessage,
}

#[derive(Serialize, Deserialize)]
struct ChatCompletionResponse {
    pub choices: Vec<ChatCompletionChoice>,
}

/// Represents an error payload returned by the `OpenRouter` API when a request
/// fails with a non-2xx status code. The `metadata` field captures additional
/// provider-specific information such as the raw upstream error body.
#[derive(Serialize, Deserialize)]
struct OpenRouterError {
    pub message: String,
    pub code: i32,
    #[serde(default)]
    pub metadata: Option<Value>,
}

/// Top-level error envelope returned by `OpenRouter` on non-2xx responses.
#[derive(Serialize, Deserialize)]
struct OpenRouterErrorResponse {
    pub error: OpenRouterError,
}

/// Sends a chat-completion request to the `OpenRouter` API, checks the HTTP
/// status code, and parses the response body.
///
/// # Why this is a separate function
///
/// The request body construction, HTTP call, status-code gating, and chat-
/// completion deserialization collectively represent a single responsibility:
/// "call the LLM and get back a structured `ChatCompletionResponse`."
/// Extracting it keeps `pick_supervisor` focused on orchestration.
///
/// # Arguments
///
/// * `openrouter_base_url` - Base URL for the `OpenRouter` API.
/// * `openrouter_api_key` - `OpenRouter` API key.
/// * `prompt` - The assembled user prompt (prompt + examples + JSON schema).
///
/// # Returns
///
/// The `ChatCompletionResponse` on success.
///
/// # Errors
///
/// `AppError::OpenRouter` on non-2xx upstream status. `AppError::Deserialization`
/// when the 2xx body cannot be parsed. `AppError::EmptyChoices` when the LLM
/// returns zero choices. `AppError::Internal` on network/HTTP-client errors.
async fn send_openrouter_chat_completion(
    openrouter_base_url: &str,
    openrouter_api_key: &str,
    prompt: &str,
) -> Result<ChatCompletionResponse, AppError> {
    // `response_format` must use the API-supported format. DeepSeek (and
    // OpenAI-compatible providers) expect `{"type": "json_object"}` — sending
    // a raw JSON Schema object with `"type": "object"` at the root is rejected
    // because the provider interprets `response_format.type` and sees `object`,
    // which is not a recognised variant (valid: json_object, json_schema,
    // regex, text).
    let request_body = json!({
        "model": "deepseek/deepseek-v4-flash",
        "messages": [
            {
                "role": "system",
                "content": "Answer based only on given context. Do not search the internet or make any tool calls."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "response_format": {
            "type": "json_object"
        },
        "provider": {
            "only": ["deepseek"],
            "allow_fallbacks": false
        }
    });
    let reqwest_client = reqwest::Client::builder().build().map_err(|e| {
        return AppError::Internal(format!("failed to build HTTP client: {e}"));
    })?;
    let request = reqwest_client
        .request(
            reqwest::Method::POST,
            format!("{openrouter_base_url}/chat/completions"),
        )
        .header("Authorization", format!("Bearer {openrouter_api_key}"))
        .json(&request_body);
    let response = request.send().await.map_err(|e| {
        return AppError::Internal(format!("HTTP request to OpenRouter failed: {e}"));
    })?;

    // Capture the HTTP status code immediately — `.text()` consumes the
    // response, so we must read it before attempting to parse the body.
    let status = response.status();

    // Read the raw body once so we can inspect it for both success and error
    // paths without consuming the response twice.
    let raw_text = response.text().await.map_err(|e| {
        return AppError::Internal(format!("failed to read response body: {e}"));
    })?;

    // If the upstream API returned a non-2xx status, parse the structured error
    // payload so the frontend sees a meaningful message rather than a generic
    // deserialization failure.
    if !status.is_success() {
        let error_response: OpenRouterErrorResponse = serde_json::from_str(&raw_text)
            .unwrap_or_else(|_| {
                // If the body is not even valid JSON, fall back to a minimal
                // error so the handler never panics.
                return OpenRouterErrorResponse {
                    error: OpenRouterError {
                        message: format!("OpenRouter returned HTTP {status} with unparseable body"),
                        code: i32::from(status.as_u16()),
                        metadata: None,
                    },
                };
            });
        eprintln!(
            "OpenRouter error ({}): {}",
            status, error_response.error.message
        );
        return Err(AppError::OpenRouter {
            status,
            message: error_response.error.message,
            code: error_response.error.code,
            metadata: error_response.error.metadata,
        });
    }

    // The upstream returned 2xx — parse the chat-completion body. An error
    // here indicates a schema mismatch between our struct and the actual API
    // response (provider API change, or the model was in streaming mode, etc.).
    let response_body: ChatCompletionResponse = serde_json::from_str(&raw_text).map_err(|e| {
        return AppError::Deserialization {
            context: "chat completion response".to_string(),
            detail: e.to_string(),
        };
    })?;
    return Ok(response_body);
}

async fn parse_text(
    Json(payload): Json<ParseTextRequest>,
) -> Result<Json<ParseTextResponse>, AppError> {
    let openrouter_base_url =
        env::var("OPENROUTER_BASE_URL").unwrap_or_else(|_| return "not_needed".to_string());
    let openrouter_api_key =
        env::var("OPENROUTER_API_KEY").unwrap_or_else(|_| return "not_needed".to_string());

    let response_schema = json!({
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "hanzi": {
                    "type": "string",
                    "description": "The Chinese characters (hanzi) after grouped into logical words."
                },
                "pinyin": {
                    "type": "string",
                    "description": "The pinyin of the word, with the tone(s) included."
                },
                "english": {
                    "type": "string",
                    "description": "The English translation of the Chinese word. The translation should be relevant with the given text."
                }
            },
            "required": [
                "hanzi",
                "pinyin",
                "english"
            ]
        }
    });

    let prompt = PROMPT_TEMPLATE
        .replacen("{text}", &payload.text, 1)
        .replacen(
            "{response_schema}",
            serde_json::to_string(&response_schema).unwrap().as_str(),
            1,
        );
    let response_body =
        send_openrouter_chat_completion(&openrouter_base_url, &openrouter_api_key, &prompt).await?;

    let first_choice = response_body.choices.into_iter().next().ok_or_else(|| {
        return AppError::EmptyChoices;
    })?;
    let raw_message_content = &first_choice.message.content;

    let response: ParseTextResponse = serde_json::from_str(raw_message_content).map_err(|e| {
        return AppError::Deserialization {
            context: "LLM output".to_string(),
            detail: format!("{e}. Raw content: {raw_message_content}"),
        };
    })?;
    return Ok(Json(response));
}
