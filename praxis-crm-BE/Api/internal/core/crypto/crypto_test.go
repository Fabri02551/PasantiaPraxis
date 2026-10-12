package crypto

import "testing"

func TestRoundtripString(t *testing.T) {
	secret := "test-secret-para-jwt"
	for _, tc := range []string{"admin", "visitador", "123", ""} {
		enc, err := EncryptString(secret, tc)
		if err != nil {
			t.Fatalf("EncryptString(%q): %v", tc, err)
		}
		if tc != "" && enc == tc {
			t.Fatalf("el cifrado no debe devolver el plaintext: %q", tc)
		}
		dec, err := DecryptString(secret, enc)
		if err != nil {
			t.Fatalf("DecryptString(%q): %v", tc, err)
		}
		if dec != tc {
			t.Fatalf("roundtrip: got %q want %q", dec, tc)
		}
	}
}

func TestNonDeterministic(t *testing.T) {
	secret := "test-secret-para-jwt"
	a, _ := EncryptString(secret, "admin")
	b, _ := EncryptString(secret, "admin")
	if a == b {
		t.Fatal("dos cifrados del mismo valor no deben coincidir (nonce aleatorio)")
	}
}

func TestRoundtripInt(t *testing.T) {
	secret := "test-secret-para-jwt"
	for _, n := range []int{0, 1, 42, 999999} {
		enc, err := EncryptInt(secret, n)
		if err != nil {
			t.Fatalf("EncryptInt(%d): %v", n, err)
		}
		dec, err := DecryptInt(secret, enc)
		if err != nil {
			t.Fatalf("DecryptInt(%d): %v", n, err)
		}
		if dec != n {
			t.Fatalf("roundtrip int: got %d want %d", dec, n)
		}
	}
}

func TestWrongSecretFails(t *testing.T) {
	enc, err := EncryptString("secreto-a", "admin")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := DecryptString("secreto-b", enc); err == nil {
		t.Fatal("descifrar con otro secreto debe fallar")
	}
}
