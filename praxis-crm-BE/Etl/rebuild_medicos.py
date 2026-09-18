import csv, glob, re, unicodedata
import numpy as np
import pandas as pd

SRC = "src/medicos/medicos_carteras.csv"
OUT = "src/medicos/medicos_carteras.csv"
HW = [18, 46, 8, 21, 128, 18, 18, 6, 10, 16, 10, 6, 10]   # 13 columnas de ancho fijo; ARCHIVO es el resto de la línea
COLS = ["VISITADOR ASIGNADO", "NOMBRE COMPLETO", "TIPO", "ESPECIALIDAD", "INSTITUCION",
        "CIUDAD", "TELEFONO", "EMAIL", "CATEGORIA", "PROGRAMACION", "MEDICO ID", "N°", "DUPLICADO", "ARCHIVO"]


def norm(s):
    s = str(s).strip().upper()
    s = " ".join(s.split())
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def norm_name(s):
    s = norm(s)
    for t in ("DR. ", "DRA. ", "LIC. ", "DR ", "DRA ", "LIC "):
        if s.startswith(t):
            s = s[len(t):].strip()
            break
    return s


def clean(s):
    """NaN/None -> ''"""
    if s is None or (isinstance(s, float) and np.isnan(s)):
        return ""
    return str(s).strip()


def num(s):
    if s is None or (isinstance(s, float) and np.isnan(s)):
        return ""
    try:
        f = float(str(s))
        return str(int(f)) if f.is_integer() else str(s).strip()
    except Exception:
        return str(s).strip()


def parse_csv(path):
    lines = open(path, encoding="utf-8-sig").read().rstrip("\n").split("\n")
    off, pos = [], 0
    for w in HW:
        off.append(pos)
        pos += w + 1
    tot = pos  # inicio de la columna ARCHIVO (resto de la línea)
    rows = []
    for ln in lines[1:]:
        cells = [ln[o:o + w].strip() for o, w in zip(off, HW)]
        cells.append(ln[tot:].strip())
        rows.append(cells)
    return rows


def infer_tipo(nombre, especialidad):
    n = str(nombre).upper()
    if any(k in n for k in ("DR.", "DRA.", "LIC.", "DR ", "DRA ", "LIC ")):
        return "MEDICO"
    if str(especialidad).strip().upper() == "LAB":
        return "ENTIDAD"
    if any(k in n for k in ("LAB ", "LAB.", "CLINICA", "HOSPITAL", "INSTITUTO", "FUNDACION",
                            "CENTRO", "SOC." , "SOCIEDAD", "FARMACIA", "CAJA ", "UNIDAD",
                            "SANITARY", "VETERIN", "VIDA SANA", "NACIONAL")):
        return "ENTIDAD"
    return "MEDICO"


def load_kardex(path, sheet):
    df = pd.read_excel(path, sheet_name=sheet)
    out = []
    for _, r in df.iterrows():
        nom = clean(r.get("NOMBRE COMPLETO", ""))
        if not nom:
            continue
        vis = clean(r.get("VISITADOR ASIGNADO", ""))
        if vis in ("", "*"):
            continue
        inst = clean(r.get("INSTITUCION", ""))
        if inst == "0":
            inst = ""
        out.append([
            vis, nom, "", clean(r.get("ESPECIALIDAD", "")), inst,
            clean(r.get("CIUDAD", "")), num(r.get("TELEFONO", "")),
            clean(r.get("EMAIL", "")), clean(r.get("CATEGORIA", "")),
            clean(r.get("PROGRAMACION", "")), num(r.get("MEDICO ID", "")),
            num(r.get("N°", "")), clean(r.get("DUPLICADO", "")),
            path.split("/")[-1],
        ])
    return out


def main():
    rows = parse_csv(SRC)
    print("existing csv rows:", len(rows))

    all_xlsx = sorted(glob.glob("src/medicos/*.xlsx"))
    data_rows = []
    for f in all_xlsx:
        if "DATA.KARDEX" in f:
            continue
        xl = pd.ExcelFile(f)
        for sh in xl.sheet_names:
            data_rows.extend(load_kardex(f, sh))
    print("kardex rows:", len(data_rows))

    inst_rows, medic_rows = [], []
    for sh, tipo, dcol in [("C.INST", "ENTIDAD", "DIRECCION"), ("C.MEDIC", "MEDICO", "INSTITUCION")]:
        df = pd.read_excel("src/medicos/DATA.KARDEX.xlsx", sheet_name=sh)
        for _, r in df.iterrows():
            nom = clean(r.get("NOMBRE COMPLETO", ""))
            if not nom:
                continue
            vis = clean(r.get("VISITADOR ASIGNADO", ""))
            if vis in ("", "*"):
                continue
            inst = clean(r.get(dcol, ""))
            if inst == "0":
                inst = ""
            row = [
                vis, nom, tipo, clean(r.get("ESPECIALIDAD", "")), inst,
                clean(r.get("CIUDAD", "")), num(r.get("TELEFONO", "")),
                clean(r.get("EMAIL", "")), clean(r.get("CATEGORIA", "")),
                "", num(r.get("MEDICO ID", "")) if sh == "C.MEDIC" else "",
                "", clean(r.get("DUPLICADO", "")), "DATA.KARDEX.xlsx",
            ]
            if sh == "C.INST":
                inst_rows.append(row)
            else:
                medic_rows.append(row)
    print("DATA C.INST:", len(inst_rows), " C.MEDIC:", len(medic_rows))

    VIS_STD = {"ALEJANDRA": "ALEJANDRA PAREDES"}
    VIS_DISP = {"ALEJANDRA": "ALEJANDRA PAREDES", "ALEJANDRA PAREDES": "ALEJANDRA PAREDES",
                "GUALBERTO": "GUALBERTO", "PAULO": "PAULO", "JOSHUA": "JOSHUA",
                "ROCIO MIRANDA": "ROCIO MIRANDA", "OCTAVIA CRUZ": "OCTAVIA CRUZ",
                "KAREN CASTRO": "KAREN CASTRO", "KEILA ESPINOZA": "KEILA ESPINOZA",
                "CONSUELO MUÑOZ": "CONSUELO MUÑOZ", "JAHAZIEL FACIO": "JAHAZIEL FACIO",
                "MARAHI HERRERA": "MARAHI HERRERA"}

    def vis_std(v):
        return VIS_STD.get(norm(v), norm(v))

    def vis_disp(v):
        up = str(v).strip().upper()
        return VIS_DISP.get(up, up)

    all_rows = rows + data_rows + inst_rows + medic_rows
    grouped = {}
    for r in all_rows:
        key = (vis_std(r[0]), norm_name(r[1]))
        grouped.setdefault(key, []).append(r)

    out = []
    for key, grp in grouped.items():
        grp = sorted(grp, key=lambda r: (r[0] != key[0], r[0]))
        g = grp[0][:]
        g[0] = vis_disp(grp[0][0])
        g[1] = max((str(r[1]).strip() for r in grp if r[1].strip()), key=len)
        if len(grp) == 1:
            out.append(g)
            continue
        insts = []
        for r in grp:
            i = r[4].strip()
            if i and i not in insts:
                insts.append(i)
        g[4] = "$".join(insts)
        for idx in (2, 3, 5, 6, 7, 8, 9, 10, 11, 13):
            for r in grp:
                if r[idx].strip():
                    g[idx] = r[idx].strip()
                    break
        g[2] = g[2] or infer_tipo(g[1], g[3])
        g[12] = "True" if any(str(x[12]).strip() == "True" for x in grp) else grp[0][12].strip()
        out.append(g)

    for g in out:
        g[2] = g[2] or infer_tipo(g[1], g[3])

    stable = {}
    order = []
    for r in out:
        k = (vis_std(r[0]), norm_name(r[1]))
        if k not in stable:
            stable[k] = len(order)
            order.append(k)

    widths = []
    for ci in range(13):
        w = HW[ci]
        for r in out:
            need = len(r[ci]) if ci == 0 else len(r[ci]) + 1
            w = max(w, need)
        widths.append(w)

    lines = []
    hdr = []
    for ci, h in enumerate(COLS):
        hdr.append((" " + h) if ci else h)
        hdr[ci] = hdr[ci].ljust(widths[ci] if ci < 13 else 7)
    lines.append(";".join(hdr))

    for r in out:
        cells = []
        for ci in range(13):
            val = str(r[ci]).strip()
            if ci == 0:
                cells.append(val.ljust(widths[0]))
            elif ci == 11:  # N° alineado a la derecha
                cells.append((" " + val.rjust(widths[ci] - 1)) if val else " " * widths[ci])
            else:
                cells.append((" " + val.ljust(widths[ci] - 1)) if val else " " * widths[ci])
        cells.append(" " + str(r[13]).strip())
        lines.append(";".join(cells))

    data = "\ufeff" + "\n".join(lines) + "\n"
    open(OUT, "w", encoding="utf-8", newline="").write(data)
    print("final rows:", len(lines) - 1)

    from collections import Counter
    c = Counter(r[0].strip() for r in out if r[0].strip())
    print("por visitador:")
    for k, v in sorted(c.items(), key=lambda kv: -kv[1]):
        print(f"  {k:22s} {v}")


if __name__ == "__main__":
    main()