FROM python:3.11-alpine

WORKDIR /app
COPY banners.json emulator.py ./

EXPOSE 21 22 23 80 3306 6379

CMD ["python", "emulator.py"]
