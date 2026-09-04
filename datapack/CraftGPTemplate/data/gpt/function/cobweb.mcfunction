# 1. Ejecutamos los comandos COMO el jugador que pulsó el botón
execute as @a[scores={cobweb=1}] if score @s dinero matches 25.. run give @s cobweb 64
execute as @a[scores={cobweb=1}] if score @s dinero matches 25.. run scoreboard players remove @s dinero 25
execute as @a[scores={cobweb=1}] unless score @s dinero matches 25.. run tellraw @s {"text":"No tienes suficiente dinero.","color":"red"}

# 2. Reseteamos su trigger a 0 para que no reciba premios infinitos
scoreboard players reset @a[scores={cobweb=1}] cobweb

# 3. Volvemos a habilitar el trigger para todos, para que el botón siga funcionando
scoreboard players enable @a cobweb