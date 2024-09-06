FROM denoland/deno:1.44.4

EXPOSE 8000

WORKDIR /app

ADD . /app

RUN deno cache main.ts

CMD ["run","--watch", "--allow-net", "--allow-env", "--allow-write","--allow-read","--allow-ffi","--allow-sys", "main.ts"]
