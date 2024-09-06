FROM denoland/deno

EXPOSE 8000

WORKDIR /app

ADD . /app

RUN deno cache main.ts

CMD ["run","--allow-watch", "--allow-net", "--allow-env", "--allow-read","--allow-ffi", "main.ts"]
