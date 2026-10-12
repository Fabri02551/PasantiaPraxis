package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
)

// deriveKey deriva una clave AES-256 a partir del secreto JWT.
// Usa SHA-256 para no exigir que JWT_SECRET tenga exactamente 32 bytes.
func deriveKey(secret string) [32]byte {
	return sha256.Sum256([]byte(secret))
}

func newGCM(secret string) (cipher.AEAD, error) {
	if secret == "" {
		return nil, errors.New("secreto vacío para cifrado")
	}
	key := deriveKey(secret)
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

// EncryptString cifra plaintext con AES-256-GCM y lo devuelve en base64 URL-safe.
// Cada llamada usa un nonce aleatorio, por lo que el resultado no es determinista.
func EncryptString(secret, plaintext string) (string, error) {
	gcm, err := newGCM(secret)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("no se pudo generar nonce: %w", err)
	}
	// Se antepone el nonce al ciphertext para poder descifrar después.
	out := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.RawURLEncoding.EncodeToString(out), nil
}

// DecryptString descifra un valor producido por EncryptString.
func DecryptString(secret, encoded string) (string, error) {
	gcm, err := newGCM(secret)
	if err != nil {
		return "", err
	}
	raw, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		// Compatibilidad: intenta con StdEncoding por si algún emisor usó padding.
		if raw2, err2 := base64.StdEncoding.DecodeString(encoded); err2 == nil {
			raw = raw2
		} else {
			return "", fmt.Errorf("ciphertext no es base64 válido: %w", err)
		}
	}
	nonceSize := gcm.NonceSize()
	if len(raw) < nonceSize {
		return "", errors.New("ciphertext demasiado corto")
	}
	nonce, ciphertext := raw[:nonceSize], raw[nonceSize:]
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", errors.New("no se pudo descifrar (clave incorrecta o dato corrupto)")
	}
	return string(plain), nil
}

// EncryptInt cifra un entero (usado para persona_id).
func EncryptInt(secret string, n int) (string, error) {
	return EncryptString(secret, strconv.Itoa(n))
}

// DecryptInt descifra un entero cifrado con EncryptInt.
func DecryptInt(secret, encoded string) (int, error) {
	plain, err := DecryptString(secret, encoded)
	if err != nil {
		return 0, err
	}
	n, err := strconv.Atoi(plain)
	if err != nil {
		return 0, errors.New("valor descifrado no es un entero válido")
	}
	return n, nil
}
