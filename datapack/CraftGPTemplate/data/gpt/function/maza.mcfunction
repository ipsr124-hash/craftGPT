# 1. Ejecutamos los comandos COMO el jugador que pulsó el botón
execute as @a[scores={maza=1}] if score @s dinero matches 250.. run give @s minecraft:mace 1
execute as @a[scores={maza=1}] if score @s dinero matches 250.. run scoreboard players remove @s dinero 250
execute as @a[scores={maza=1}] unless score @s dinero matches 250.. run tellraw @s {"text":"No tienes suficiente dinero.","color":"red"}

# 2. Reseteamos su trigger a 0 para que no reciba premios infinitos
scoreboard players reset @a[scores={maza=1}] maza

# 3. Volvemos a habilitar el trigger para todos, para que el botón siga funcionando
scoreboard players enable @a maza