# 1. Ejecutamos los comandos COMO el jugador que pulsó el botón
execute as @a[scores={perlas=1}] if score @s dinero matches 45.. run give @s ender_pearl 16
execute as @a[scores={perlas=1}] if score @s dinero matches 45.. run scoreboard players remove @s dinero 45
execute as @a[scores={perlas=1}] unless score @s dinero matches 45.. run tellraw @s {"text":"No tienes suficiente dinero.","color":"red"}

# 2. Reseteamos su trigger a 0 para que no reciba premios infinitos
scoreboard players reset @a[scores={perlas=1}] perlas

# 3. Volvemos a habilitar el trigger para todos, para que el botón siga funcionando
scoreboard players enable @a perlas