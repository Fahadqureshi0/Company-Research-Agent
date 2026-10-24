FROM python:3.11-slim

# Hugging Face runs containers as user 1000, so create it and give it the app folder
RUN useradd -m -u 1000 user && mkdir -p /app/reports && chown -R user:user /app
USER user
ENV PATH="/home/user/.local/bin:$PATH"
WORKDIR /app

COPY --chown=user:user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=user:user . .

EXPOSE 7860
# No --reload in production
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
