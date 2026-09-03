package com.geminichat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class GeminiClient {
    private final HttpClient client = HttpClient.newHttpClient();

    public String generateContent(String userPrompt) throws Exception {
        if (Config.GEMINI_API_KEY.isEmpty()) {
            return "Error: Falta la variable de entorno GEMINI_API_KEY.";
        }

        String url = "https://generativelanguage.googleapis.com/v1beta/models/" 
                + Config.GEMINI_MODEL + ":generateContent?key=" + Config.GEMINI_API_KEY;

        String jsonPayload = String.format("""
            {
              "system_instruction": {
                "parts": [{"text": %s}]
              },
              "contents": [{
                "parts": [{"text": %s}]
              }]
            }
            """, Json.escape(Config.getSystemPrompt()), Json.escape(userPrompt));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() == 200) {
            String reply = Json.extractValue(response.body(), "text");
            return reply.isEmpty() ? "Sin respuesta del modelo." : reply;
        } else {
            return "Error de la API Gemini (" + response.statusCode() + "): " + response.body();
        }
    }
}