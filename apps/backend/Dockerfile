FROM debian:bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY target/release/main .
ENV HOST=0.0.0.0
EXPOSE 8080
CMD ["./main"]
