#!/bin/bash
set -e
API="${API_BASE_URL:-http://localhost:3000/api}"
EMAIL="vlajic.p27@gmail.com"

echo "1. Login (koristi postojećeg usera ili prilagodi email/password)..."
LOGIN_RESP=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@ukbonn.de","password":"Test123!"}')

if echo "$LOGIN_RESP" | grep -q '"token"'; then
  TOKEN=$(echo "$LOGIN_RESP" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  echo "   Token dobijen."
else
  echo "   Login nije uspeo (možda nema testuser@ukbonn.de). Pokušavam registraciju..."
  REG_RESP=$(curl -s -X POST "$API/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"testuser@ukbonn.de","password":"Test123!","firstName":"Test","lastName":"User"}')
  if echo "$REG_RESP" | grep -q '"token"'; then
    TOKEN=$(echo "$REG_RESP" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
    echo "   Registracija uspešna, token dobijen."
  else
    echo "   Registracija takođe nije uspela. Odgovor: $REG_RESP"
    exit 1
  fi
fi

echo "2. Šaljem completed survey na $EMAIL (sa potpisom, da stigne PDF)..."
# Minimalan PNG (1x1) kao potpis da PDF sadrži "Signature" sekciju
SIG_B64="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
BODY=$(cat <<EOF
{
  "draft": false,
  "status": "completed",
  "intervieweeEmail": "$EMAIL",
  "intervieweeName": "Test Korisnik",
  "intervieweePhone": "+381601234567",
  "submittedAt": "2025-03-03T12:00:00.000Z",
  "answers": [
    { "questionId": "q1", "type": "TEXT", "value": "Test odgovor za PDF" },
    { "questionId": "q2", "type": "NUMBER", "value": 5 }
  ],
  "signatureBase64": "$SIG_B64"
}
EOF
)

RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/responses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$BODY")
HTTP_CODE=$(echo "$RESP" | tail -n1)
BODY_RESP=$(echo "$RESP" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
  echo "   Survey poslat (201). Proveri inbox (i Spam) na $EMAIL – trebalo bi da stigne PDF."
  echo "$BODY_RESP" | head -c 500
  echo ""
else
  echo "   Greška: HTTP $HTTP_CODE"
  echo "$BODY_RESP"
  exit 1
fi
