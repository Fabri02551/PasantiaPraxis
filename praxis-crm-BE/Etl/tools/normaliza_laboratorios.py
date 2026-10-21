#!/usr/bin/env python3
"""Normaliza src/laboratorios/precios_base_por_departamento.csv.

El archivo original viene de una hoja de Excel y mezcla dos convenciones:

  * separador coma con relleno de espacios alrededor de cada campo
  * comillas para proteger los estudios que llevan coma en el nombre, pero
    solo en algunas filas y con escapes de Excel ("")

encoding/csv de Go rechaza el relleno despues de una comilla de cierre
("...texto..."   ,) y, con LazyQuotes, fusiona 632 lineas fisicas en 124
registros: los precios quedarian corridos respecto al estudio. Por eso el
archivo se normaliza una vez aqui en vez de depender de un parser tolerante.

El formato de destino es CSV estandar: coma, sin relleno, con comillas
solo donde hacen falta. Cualquier lector lo entiende.

La reconstruccion usa la estructura conocida del archivo: clave, estudio,
area, descuento y cinco precios al final. El estudio es el unico campo que
puede contener comas, asi que se arma con todo lo que quede entre la clave
y el area.

Uso:  python3 tools/normaliza_laboratorios.py
"""

import csv
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "src" / "laboratorios" / "precios_base_por_departamento.csv"

PRECIO = re.compile(r"^\d+(\.\d+)?$")
COLUMNAS_PRECIO = [
    "precio_base_cbba",
    "precio_base_lpz",
    "precio_base_scz",
    "precio_base_sucre",
    "precio_base_tarija",
]
CAMPOS = ["clave", "estudio", "area", "descuento", *COLUMNAS_PRECIO]


def partir(linea: str) -> dict | None:
    # Las comillas solo servisolen para proteger comas del nombre del
    # estudio. Se quitan todas: los "" de Excel son comillas literales que
    # no aparecen en ningun nombre real de estudio.
    campos = [c.strip() for c in linea.replace('"', "").split(",")]
    if len(campos) < len(CAMPOS):
        return None

    precios = campos[-len(COLUMNAS_PRECIO):]
    descuento = campos[-len(COLUMNAS_PRECIO) - 1]
    area = campos[-len(COLUMNAS_PRECIO) - 2]
    # Todo lo que sobra entre la clave y el area es el nombre del estudio,
    # unido de vuelta con coma.
    estudio = ", ".join(c for c in campos[1:-len(COLUMNAS_PRECIO) - 2] if c)

    if not estudio:
        return None

    return {
        "clave": campos[0],
        "estudio": estudio,
        "area": area,
        "descuento": descuento,
        **{
            col: (valor if PRECIO.match(valor) else "0.0")
            for col, valor in zip(COLUMNAS_PRECIO, precios)
        },
    }


def main() -> int:
    # La primera linea es el encabezado original: se salta para no volver a
    # escribirla como si fuera un estudio mas.
    lineas = ORIGEN.read_text(encoding="utf-8-sig").splitlines()[1:]

    filas, saltadas = [], []
    for numero, linea in enumerate(lineas, 1):
        if not linea.strip():
            continue
        fila = partir(linea)
        if fila is None:
            saltadas.append(numero)
            continue
        filas.append(fila)

    if saltadas:
        print(f"ATENCION: {len(saltadas)} lineas sin los 9 campos, se omiten: {saltadas[:20]}")

    vistos: dict[str, int] = {}
    for fila in filas:
        clave = fila["estudio"].casefold()
        vistos[clave] = vistos.get(clave, 0) + 1
    repetidos = {k: v for k, v in vistos.items() if v > 1}
    if repetidos:
        print(f"ATENCION: {len(repetidos)} estudios repetidos, se conservara el ultimo: {list(repetidos)[:10]}")

    with ORIGEN.open("w", encoding="utf-8", newline="") as f:
        escritor = csv.DictWriter(f, fieldnames=CAMPOS, quoting=csv.QUOTE_MINIMAL)
        escritor.writeheader()
        for fila in filas:
            escritor.writerow(fila)

    print(f"OK: {ORIGEN.relative_to(RAIZ)} normalizado, {len(filas)} estudios")
    return 0


if __name__ == "__main__":
    sys.exit(main())
