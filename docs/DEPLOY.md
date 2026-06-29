# Deploy — Service Desk (Chamados) em servidor Debian 12 (offline em runtime)

Guia para instalar o sistema **ao lado** de um XAMPP (easyLife) **sem tocar nele**.

## Regras de isolamento (inquebráveis)
- **NUNCA** alterar `/opt/lampp` (XAMPP/easyLife) nem seus serviços/portas.
- easyLife usa **80, 443 (Apache), 3306 (MySQL), 21 (FTP)** — não usamos nenhuma.
- Nosso app: pasta **`/opt/chamados`**, porta **8080**. Banco **PostgreSQL** na **5432**
  (motor diferente do MySQL; sem conflito).
- A API serve o site na MESMA porta (mesma origem) → **não usamos Apache**.

Pré-requisitos: Debian 12, usuário com `sudo`, internet durante a instalação.
Servidor: `192.42.0.102` → usuários acessam **http://192.42.0.102:8080**.

---

## Fase 1 — Instalar pré-requisitos (git, Node 20, PostgreSQL)
```bash
sudo apt-get update
sudo apt-get install -y git
# Node.js 20 LTS (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
# PostgreSQL (serviço próprio, porta 5432)
sudo apt-get install -y postgresql postgresql-client
# conferências
node -v; npm -v; psql --version; git --version
# garantir que o easyLife NÃO foi afetado (XAMPP segue em 80/443/3306):
ss -tln | grep -E ':80|:443|:3306'
```

## Fase 2 — Pasta do app + clonar o código
```bash
sudo mkdir -p /opt/chamados
sudo chown "$USER":"$USER" /opt/chamados
git clone https://github.com/FabioMarinhoDesenvolvedor/chamados-repo.git /opt/chamados
ls /opt/chamados   # deve listar packages/, docs/, etc.
```

## Fase 3 — Banco PostgreSQL + arquivo .env (segredos gerados no servidor)
Rode tudo no MESMO terminal (as variáveis precisam persistir):
```bash
cd /opt/chamados
DBPASS="$(openssl rand -hex 16)"
JWT="$(openssl rand -hex 48)"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
CREATE USER chamados WITH PASSWORD '${DBPASS}';
CREATE DATABASE chamados OWNER chamados;
SQL
mkdir -p /opt/chamados/data/backups /opt/chamados/data/anexos
cat > /opt/chamados/packages/api/.env <<EOF
DATABASE_URL="postgresql://chamados:${DBPASS}@localhost:5432/chamados?schema=public"
JWT_SECRET="${JWT}"
JWT_EXPIRES_IN="1d"
PORT=8080
PG_DUMP_PATH=/usr/bin/pg_dump
BACKUP_DOCKER_CONTAINER=
BACKUP_DIR=/opt/chamados/data/backups
ATTACHMENTS_DIR=/opt/chamados/data/anexos
EOF
echo "OK: banco 'chamados' criado e .env escrito (segredos aleatórios)."
```

## Fase 4 — Dependências, banco e build
```bash
cd /opt/chamados
npm ci
npm run db:generate                      # gera o Prisma Client (engine Linux)
npm run db:deploy -w @chamados/api       # aplica as migrations (produção)
npm run db:seed:admin -w @chamados/api   # cria SÓ 1 admin (sistema limpo)
npm run build                            # build de shared + api + web
```
> **Sistema limpo:** nada de chamados/departamentos/usuários de exemplo. Cria apenas o
> admin `ti@juventus.com.br` (sem senha definida). Na tela de login use
> **"Primeiro acesso? Defina sua senha"** para definir a senha do admin; depois cadastre
> departamentos e usuários pela interface.
> (Para um e-mail de admin diferente: `ADMIN_EMAIL=voce@empresa.local npm run db:seed:admin -w @chamados/api`.)

## Fase 5 — Serviço systemd (sobe no boot, reinicia sozinho, roda offline)
```bash
sudo tee /etc/systemd/system/chamados.service > /dev/null <<'EOF'
[Unit]
Description=Service Desk (Chamados) - API + site
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=fabio
WorkingDirectory=/opt/chamados/packages/api
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now chamados
sudo systemctl status chamados --no-pager | head -15
```
> Se `User=fabio` não for o seu usuário, ajuste. `node` deve estar em `/usr/bin/node`
> (confira com `command -v node` e ajuste o `ExecStart` se diferente).

## Fase 6 — Verificação
```bash
sleep 3
curl -s -o /dev/null -w "site /        -> HTTP %{http_code}\n" http://localhost:8080/
curl -s -o /dev/null -w "api login     -> HTTP %{http_code}\n" \
  -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"ti@juventus.com.br","password":"senha123"}'
echo "--- easyLife (XAMPP) intacto? 80/443/3306 ainda de pé: ---"
ss -tln | grep -E ':80|:443|:3306'
```
Acesse de outra máquina da rede: **http://192.42.0.102:8080**
(se houver firewall ativo: `sudo ufw allow 8080/tcp`).

## Fase 7 — Pós-instalação
- **Trocar as senhas padrão**: entre como `ti@juventus.com.br` (senha123) e use
  "Configurações → trocar senha"; idem para o usuário comum.
- **Acessar o banco** (quando precisar): `sudo -u postgres psql -d chamados`
  ou `PGPASSWORD=... psql -h localhost -U chamados -d chamados`.
- **Backups**: ficam em `/opt/chamados/data/backups` (job diário 02:00 + botão no app).

## Backup externo (off-site, via SMB)
Os backups locais (`/opt/chamados/data/backups`) são copiados todo dia para um
compartilhamento de rede, para sobreviver à perda do servidor.
- Credenciais (chmod 600): `/opt/chamados/.smbcreds` (`username`/`password`/`domain`).
- Script: `/opt/chamados/backup-offsite.sh` → via `smbclient`, envia o banco (`.sql.gz`)
  para `//172.16.3.10/Conselho/backupchamados` e as imagens para `.../backupchamados/anexos`.
- Agendamento (cron do usuário): `30 2 * * * /opt/chamados/backup-offsite.sh` (após o
  backup interno das 02:00). Log em `/opt/chamados/data/backup-offsite.log`.
- Teste manual: `/opt/chamados/backup-offsite.sh && tail /opt/chamados/data/backup-offsite.log`
  (deve terminar com `OK`).

## Atualizar o sistema depois (nova versão)
```bash
cd /opt/chamados
git pull
npm ci
npm run db:generate
npm run db:deploy -w @chamados/api
npm run build
sudo systemctl restart chamados
```

## Desinstalar (sem afetar o easyLife)
```bash
sudo systemctl disable --now chamados
sudo rm /etc/systemd/system/chamados.service && sudo systemctl daemon-reload
sudo -u postgres psql -c "DROP DATABASE chamados;" -c "DROP USER chamados;"
sudo rm -rf /opt/chamados
# (Node e PostgreSQL podem ser removidos via apt se não forem usados por mais nada.)
```
