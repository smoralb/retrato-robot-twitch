# Retrato Robot · Twitch

Web estática (HTML + JS, sin backend ni IA) que genera un retrato robot en ASCII y un
"perfil policial" de broma a partir de tu actividad en el chat de Twitch.

## Cómo funciona

1. **Login con Twitch** (OAuth *implicit flow*, el token se queda en `sessionStorage`).
2. **API de Twitch (Helix)**: tu perfil (fecha de alta, bio), canales que sigues, juego e
   idioma de esos canales y tu color de chat.
3. **Mensajes**: Twitch **no ofrece ningún endpoint para descargar tu historial de chat**.
   Por eso se consultan los logs públicos de [logs.ivr.fi](https://logs.ivr.fi) (rustlog) en
   los canales que sigues y que ese servicio archiva. Si no hay nada, puedes pegar mensajes a mano.
4. **Análisis heurístico** (`js/analyzer.js`): jerga por generación, regionalismos, mayúsculas,
   tacos, horas de actividad, juegos… → edad, situación laboral, origen, rasgos.
5. **Retrato** (`js/portrait.js`): cara ASCII montada por piezas (pelo, cejas, ojos, gafas,
   barba, cascos…) según esos rasgos, con semilla por usuario para que siempre salga igual.

## Puesta en marcha

1. Crea una app en <https://dev.twitch.tv/console/apps>:
   - **OAuth Redirect URLs**: `http://localhost:5173/`
   - **Client type**: Public
2. Pega el **Client ID** en `js/config.js`.
3. Sirve la carpeta (hace falta HTTP, no vale abrir el archivo):

   ```sh
   npx serve -l 5173 .
   ```

4. Abre <http://localhost:5173/>. El botón "Ver un ejemplo" funciona sin configurar nada.

## Publicar en GitHub Pages

1. Sube el repo a GitHub y activa Pages: *Settings → Pages → Deploy from a branch → `main` / `(root)`*.
2. En la consola de Twitch añade también la Redirect URL pública, por ejemplo
   `https://TU_USUARIO.github.io/retrato-robot-twitch/` (con `https` y la barra final).
   Puedes tener varias a la vez, así que la de `localhost` sigue funcionando.
3. No hace falta tocar el código: si `REDIRECT_URI` es `null` se usa la URL desde la que se abre la web.

El Client ID es público, se puede subir al repo. Esta app no usa Client Secret.

Scope pedido: `user:read:follows`.
