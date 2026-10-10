FROM python:3.11-alpine

WORKDIR /app
COPY trap_server.py ./

ENV TRAP_PORT=8080
EXPOSE 8080

CMD ["python", "trap_server.py"]
