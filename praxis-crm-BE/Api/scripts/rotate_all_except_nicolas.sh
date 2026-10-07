#!/bin/sh
# SOLO CREAR - NO EJECUTAR
# Ejecutar: docker exec praxis-api sh /app/scripts/rotate_all_except_nicolas.sh
set -eu

DB_HOST=db
DB_USER=praxis
DB_NAME=praxis_crm
DB_PASS=praxis_secret
SMTP_USER=soporte@laboratoriopraxis.com
SMTP_PASS=DOCdfsSd11@
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465

EMAILS=$(PGPASSWORD=$DB_PASS psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -A -c \
  "SELECT LOWER(email) FROM users WHERE LOWER(email) != 'nicolastocoyucra@gmail.com' ORDER BY email;")

python3 -c "
import smtplib, ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import secrets, string, os, subprocess

emails = '''$EMAILS'''.strip().splitlines()
ctx = ssl.create_default_context()
sent = 0
for em in emails:
    if not em: continue
    newpass = ''.join(secrets.choice(string.ascii_letters+string.digits) for _ in range(12))
    try:
        h = subprocess.check_output(['python3','-c',f\"import bcrypt; print(bcrypt.hashpw(b'{newpass}', bcrypt.gensalt(10)).decode())\"]).decode().strip()
    except:
        continue
    os.system(f\"PGPASSWORD=$DB_PASS psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c \\\"UPDATE users SET password_hash='{h}', updated_at=NOW() WHERE LOWER(email)='{em}';\\\" >/dev/null 2>&1\")
    try:
        msg = MIMEMultipart()
        msg['From'] = 'Laboratorio Praxis <soporte@laboratoriopraxis.com>'
        msg['To'] = em
        msg['Subject'] = 'Nueva contraseña'
        html = f'<html><body><p>Hola,</p><p>Email: {em}</p><p>Nueva contraseña: {newpass}</p><p>Saludos,<br/>Laboratorio Praxis</p></body></html>'
        msg.attach(MIMEText(html,'html'))
        with smtplib.SMTP_SSL('$SMTP_HOST', int('$SMTP_PORT'), context=ctx, timeout=60) as s:
            s.login('$SMTP_USER','$SMTP_PASS')
            s.sendmail('$SMTP_USER', em, msg.as_string())
        sent += 1
    except Exception as e:
        pass
print(f'TOTAL={sent}')
"
