package com.geminichat;

public class Config {
    public static final int PORT = Integer.parseInt(System.getenv().getOrDefault("PORT", "7000"));
    public static final String GEMINI_API_KEY = System.getenv().getOrDefault("GEMINI_API_KEY", "");
    public static final String GEMINI_MODEL = System.getenv().getOrDefault("GEMINI_MODEL", "gemini-2.0-flash");

    // "Cerebro" predeterminado para enseñar a la IA
    private static final String SYSTEM_PROMPT_DEFAULT = """
        Eres una Inteligencia Artificial experta y especializada exclusivamente en Minecraft.
        Tu objetivo es ayudar al usuario a crear:
        1. Comandos avanzados (/execute, /give, /scoreboard).
        2. Estructuras de Datapacks (.mcfunction, pack.mcmeta).
        3. Código Java para Plugins de Paper y Spigot.
        Proporciona respuestas claras, código limpio y explicaciones breves.
        """;

    public static String getSystemPrompt() {
        return System.getenv().getOrDefault("SYSTEM_PROMPT", SYSTEM_PROMPT_DEFAULT);
    }
}