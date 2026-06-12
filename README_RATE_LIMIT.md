# Rate Limiting — Professeur Léna

## Architecture hybride (Sprint 9.1)

Le rate limiting fonctionne en deux modes selon les variables d'environnement disponibles.

### Mode in-memory (défaut — MVP)

Activé quand `UPSTASH_REDIS_REST_URL` n'est pas définie.

Implémenté dans `lib/rate-limit.ts`. Chaque instance Lambda Vercel maintient son propre store `Map<string, RateLimitBucket>` en mémoire. Les quotas se réinitialisent au redémarrage (cold start).

Convient parfaitement pour le MVP et les déploiements à faible charge. Score de production : 7/10.

### Mode Redis distribué (production)

Activé automatiquement quand `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN` sont définies.

Implémenté dans `lib/rate-limit-redis.ts`. Utilise Upstash Redis avec l'algorithme **sliding window** via `@upstash/ratelimit` :

- **Atomique** : check + incrément en une seule opération INCR — pas de race condition
- **Cross-instances** : toutes les Lambda partagent le même compteur Redis
- **Persistant** : les compteurs survivent aux cold starts
- **Sliding window** : élimine l'attaque de frontière (ex: 29 req à 23h59 + 29 req à 00h01)

Score de production : 9/10.

---

## Limites configurées

| Route | Horaire | Journalier |
|---|---|---|
| `correct-homework` | 30 req/h | 100 req/j |
| `generate-questions` | 20 req/h | 50 req/j |
| `check-answers` | 50 req/h | 150 req/j |

Ces valeurs sont dans `lib/rate-limit.ts` → `BASE_LIMITS`. Modifier ici uniquement.

---

## Activation Redis (Upstash)

### 1. Créer une base Upstash

1. Aller sur [console.upstash.com](https://console.upstash.com)
2. Créer un compte (gratuit — 10 000 requêtes/jour incluses)
3. Créer une base **Redis** (choisir la région la plus proche de tes utilisateurs)
4. Dans l'onglet **REST API**, copier :
   - `UPSTASH_REDIS_REST_URL` (format : `https://xxx-xxx.upstash.io`)
   - `UPSTASH_REDIS_REST_TOKEN` (token JWT longue chaîne)

### 2. Configurer localement

Dans `.env.local` (jamais commité) :

```env
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxxxxxxxxxx
```

### 3. Configurer sur Vercel

Dans **Vercel Dashboard → Settings → Environment Variables** :

| Nom | Valeur | Environnements |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | `https://...` | Production, Preview |
| `UPSTASH_REDIS_REST_TOKEN` | `AXxx...` | Production, Preview |

Redéployer après ajout.

---

## Comportement des routes

```
POST /api/correct-homework
POST /api/generate-questions
POST /api/check-answers

→ Extraire l'IP (x-forwarded-for > x-real-ip > cf-connecting-ip > user-agent)
→ await checkRateLimit(ip, route)          ← async, hybride auto
   → Si Redis configuré : sliding window atomique
   → Sinon : in-memory fixed window
→ Si !allowed → 429 { error: 'rate_limit_exceeded', message: '...' }
→ Appel OpenAI
→ await recordUsage(ip, route)             ← no-op en mode Redis
```

### Réponse 429

```json
{
  "error": "rate_limit_exceeded",
  "message": "Tu as atteint la limite temporaire. Réessaie dans quelques minutes."
}
```

---

## Fichiers concernés

| Fichier | Rôle |
|---|---|
| `lib/rate-limit.ts` | Rate limiter in-memory (Sprint 9) — ne pas modifier |
| `lib/rate-limit-redis.ts` | Module hybride — point d'entrée des 3 routes |
| `app/api/correct-homework/route.ts` | Import depuis `rate-limit-redis` |
| `app/api/generate-questions/route.ts` | Import depuis `rate-limit-redis` |
| `app/api/check-answers/route.ts` | Import depuis `rate-limit-redis` |
| `app/api/rate-limit-stats/route.ts` | Dashboard admin — stats in-memory uniquement |
| `app/admin/page.tsx` | Dashboard `/admin` — section Rate Limiting |

---

## Évolutions futures

### Tier premium

Le paramètre `_tier` est réservé dans `checkRateLimit()`. Pour activer :

1. Implémenter la détection du tier dans les routes (JWT, session, ou header custom)
2. Passer `tier: 'premium'` à `checkRateLimit()`
3. En mode in-memory : `PREMIUM_MULTIPLIER = 5` dans `lib/rate-limit.ts`
4. En mode Redis : créer des limiters séparés avec `× 5` dans `lib/rate-limit-redis.ts`

### Stats Redis dans le dashboard admin

Actuellement, `/api/rate-limit-stats` retourne les stats in-memory (compteurs locaux à l'instance).
Pour les stats Redis : utiliser `redis.keys('rl:*')` + `redis.get()` pour agréger les compteurs.

---

## Plan tarifaire Upstash (référence juin 2026)

| Plan | Prix | Requêtes/jour | Adapté pour |
|---|---|---|---|
| Free | 0 € | 10 000 | MVP, test |
| Pay-as-you-go | ~0,20 $/10k req | Illimité | Production |
| Pro | ~10 $/mois | 1M/jour inclus | Scale |

Chaque appel `checkRateLimit()` consomme 2 requêtes Redis (hourly + daily). Avec 100 corrections/jour → ~200 req Redis/jour → Free tier suffisant.
