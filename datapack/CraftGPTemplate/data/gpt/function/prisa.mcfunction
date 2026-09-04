# 1. Ejecutamos los comandos COMO el jugador que pulsó el botón
execute as @a[scores={prisa=1}] if score @s dinero matches 65.. run give @s splash_potion[potion_contents={custom_color:16701501,custom_effects:[{id:haste,duration:3600,amplifier:2}]},custom_name=[{"text":"Poción de Prisa Minera III","italic":false}]]
execute as @a[scores={prisa=1}] if score @s dinero matches 65.. run scoreboard players remove @s dinero 65
execute as @a[scores={prisa=1}] unless score @s dinero matches 65.. run tellraw @s {"text":"No tienes suficiente dinero.","color":"red"}

# 2. Reseteamos su trigger a 0 para que no reciba premios infinitos
scoreboard players reset @a[scores={prisa=1}] prisa

# 3. Volvemos a habilitar el trigger para todos, para que el botón siga funcionando
scoreboard players enable @a prisa