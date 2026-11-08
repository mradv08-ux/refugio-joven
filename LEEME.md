# Refugio Joven · Control de acceso del Centro Joven

App de The Wild Side para el Centro Joven de San Juan del Puerto: registrar a los chavales que entran, ver cuántos días vienen, poner faltas y repartir el dinero según los días que trabaja cada uno.

## Qué hace

- **Puerta**: escribes el nombre, pulsas **Entrar** y listo. Si no existe, sale **Apuntar como nuevo** (nombre + edad). Arriba marcas quién curra ese día.
- **Nombres repetidos**: si ya hay alguien que se llama igual (aunque cambie una tilde o mayúscula), la app no deja guardarlo y te pide añadir apellido, inicial o apodo. Si solo se parece (dos "Carlos"), te avisa para que no lo apuntes dos veces.
- **Chavales**: lista con días que han venido y faltas. Toca uno para ver su ficha, cambiar datos o **Poner falta** (leve, moderada o grave). Al darle entrada a alguien con faltas graves, la app avisa.
- **Material**: billar, ordenador 1 y 2, futbolín, PS5, ping pong y mando de la TV.
  - **Dar turno**: tocas el juego y vas tocando nombres. El primero es el **responsable 🔑**; los demás, su grupo. Con la 🔑 de otro lo cambias.
  - **No acaparar**: quien está jugando a un juego no puede apuntarse a la espera de ese juego ni entrar en el turno siguiente (sale "acaba de jugar"). Nadie puede estar en dos grupos de la misma lista.
  - **Lista de espera** en cada juego: **+ Apuntar grupo**. Al dar el siguiente turno, se cargan solos los primeros de la lista.
  - **Tiempo**: PS5 y ordenadores 1 h; billar, futbolín y ping pong 30 min. El tiempo que lleva cada grupo se ve siempre; el límite solo cuenta si hay alguien esperando. A 5 min del final se pone amarillo; si se pasan, **rojo** y el reloj sigue hasta el cambio.
  - **Recibir y revisar**: el grupo entrega el material en recepción, lo revisáis (todo bien / algo roto / falta algo, con falta al responsable) y el juego queda libre. Nunca pasa solo al siguiente.
  - **Dar turno al siguiente**: con el juego libre, toca el juego y pulsa **▶ Dar turno a…**: un toque y se lo das al nº 1 de la lista.
  - **Solo responsable**: mismo grupo, cambia quién se hace cargo (los dos en recepción). El reloj **no** se reinicia.
- **Turnos y €**: días de apertura del mes (viernes, sábado y domingo), quién trabajó cada uno, y calculadora de reparto: pones el dinero y te dice cuánto le toca a cada uno. Botón para copiar el resumen y pegarlo en WhatsApp.

## Mi Refugio (la app de los chavales)

Los chavales tienen su propia página, **solo para mirar**: `https://mradv08-ux.github.io/refugio-joven/mi.html`

- **Qué ven**: si se están portando bien o tienen faltas (solo las suyas, con el motivo), sus días este mes y en total, si están jugando o en qué puesto de la lista de espera van, y todos los juegos con su tiempo y su lista de espera (los nombres de los demás salen recortados, ej. "Carlos M.").
- **Qué no ven**: nada de otros chavales más allá del nombre recortado en las listas. No pueden apuntarse ni tocar nada: para eso, recepción.
- **Cómo entran**: abre su ficha en **Chavales** → **📱 Su acceso a «Mi Refugio»**. Que escanee el QR con la cámara del móvil y entra directo (se queda guardado). También pueden escribir el código de 8 letras en la web.
- **Si un código se pierde o lo comparten**: en la ficha, **Código nuevo**. El anterior deja de funcionar al momento.
- Para tenerla como app: en su móvil, **Añadir a pantalla de inicio**.

## Quién entra

Solo dos cuentas, con el **mismo correo y contraseña que en Wild Pass**:

- thewildsidebusiness@gmail.com (Mister)
- castellanoleira@gmail.com (Leira)

Cualquier otra cuenta ve "Zona restringida". Los datos se guardan en el proyecto **Wild Pass** de Supabase, en tablas aparte que empiezan por `cj_`. No tocan nada de Wild Pass.

## Publicarla en GitHub Pages (gratis)

1. Entra en github.com con la cuenta **mradv08-ux**.
2. Pulsa **+** (arriba a la derecha) → **New repository**. Nombre: `refugio-joven`. Márcalo **Public** y pulsa **Create repository**.
3. Pulsa **uploading an existing file** y arrastra **todo el contenido** de esta carpeta (incluida la carpeta `img`). Pulsa **Commit changes**.
4. Ve a **Settings** → **Pages**. En **Branch** elige `main` y `/ (root)` y pulsa **Save**.
5. En 1–2 minutos estará en `https://mradv08-ux.github.io/refugio-joven/`. Mándale ese enlace a Leira.

Por qué público: GitHub Pages gratis solo funciona con repos públicos. No pasa nada: el código no tiene datos de nadie; los datos están protegidos en Supabase.

## Instalarla en el móvil

- **iPhone**: abre el enlace en **Safari** → botón **Compartir** → **Añadir a pantalla de inicio**.
- **Android**: abre en **Chrome** → menú **⋮** → **Instalar app**.

## Si olvidáis la contraseña

En la pantalla de entrada, escribe el correo y pulsa **He olvidado la contraseña**. Para que el enlace del correo vuelva a esta app, añade su dirección en Supabase: **Authentication** → **URL Configuration** → **Redirect URLs** → **Add URL** → `https://mradv08-ux.github.io/refugio-joven/`. Ojo: la contraseña es la misma que en Wild Pass, así que cambia en las dos.

## Añadir a alguien más al equipo

En Supabase, abre el proyecto **Wild Pass** → **SQL Editor** y ejecuta (cambiando los datos):

```sql
insert into public.cj_equipo (email, nombre, color) values ('correo@ejemplo.com', 'Nombre', '#c6a74c');
```

La persona necesita tener cuenta en Wild Pass con el correo confirmado. Aparecerá sola en los turnos y en el reparto.

## Si cambias algo del código

Sube el número de `VERSION` en `sw.js` (por ejemplo `refugio-joven-v2`) o los móviles seguirán viendo la versión vieja.

## Límites del plan gratis

- Supabase gratis pausa el proyecto si pasa **7 días sin uso**. Como abrís cada fin de semana (y Wild Pass también lo usa), no debería pasar.
- Hay sitio de sobra: miles de chavales y años de entradas.

## Protección de datos

Son datos de menores: pedid solo nombre y edad, nada más. La página de privacidad está en `legal.html`. Conviene poner un cartel en el centro indicando que se registra la asistencia y que pueden pedir el borrado a thewildsidebusiness@gmail.com.

## Pendiente para más adelante

- Exportar la asistencia a Excel para el Ayuntamiento.
- Gráfica de asistencia por día y edades.
- Cerrar automáticamente a quien acumule X faltas graves.
