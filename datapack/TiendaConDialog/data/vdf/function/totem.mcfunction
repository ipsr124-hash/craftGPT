# 1. Ejecutamos los comandos COMO el jugador que pulsó el botón
execute as @a[scores={totem=1}] if score @s dinero matches 100.. run give @s totem_of_undying 1
execute as @a[scores={totem=1}] if score @s dinero matches 100.. run scoreboard players remove @s dinero 100
execute as @a[scores={totem=1}] unless score @s dinero matches 100.. run tellraw @s {"text":"No tienes suficiente dinero.","color":"red"}

# 2. Reseteamos su trigger a 0 para que no reciba premios infinitos
scoreboard players reset @a[scores={totem=1}] totem

# 3. Volvemos a habilitar el trigger para todos, para que el botón siga funcionando
scoreboard players enable @a totem