// Registra una app en https://dev.twitch.tv/console/apps
// - OAuth Redirect URL: la URL exacta donde sirvas esta web (p. ej. http://localhost:5173/)
// - Category: Website Integration
// Copia aquí el Client ID (es público, no es un secreto).
export const TWITCH_CLIENT_ID = 'b3rmgc8taxvg9dlvwcvx1649nelcwx';

// Si se deja en null se usa la URL actual (sin query ni hash).
export const REDIRECT_URI = null;

// Archivo público de logs de chat (rustlog). Twitch NO ofrece historial de chat por API,
// así que los mensajes salen de aquí, solo para los canales que este servicio registra.
export const LOGS_BASE = 'https://logs.ivr.fi';

export const LIMITS = {
  maxFollows: 500,      // canales seguidos a revisar
  maxLogChannels: 15,   // canales de los que bajar logs
  monthsPerChannel: 3,  // meses de historial por canal
  concurrency: 4,
  maxFollowers: 5000,   // seguidores a cargar en el modo streamer
};
