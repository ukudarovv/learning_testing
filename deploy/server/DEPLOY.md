# Запуск на сервере (Ubuntu)

Пути по умолчанию: репозиторий `/home/ubuntu/aqlant-lms`, venv `/home/ubuntu/aqlant-lms/venv`, backend `/home/ubuntu/aqlant-lms/backend`.

## 1. Системные пакеты

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip nginx certbot python3-certbot-nginx git
# Node для сборки фронта (или собирайте локально и копируйте dist)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 2. Код и venv

```bash
cd /home/ubuntu
git clone https://github.com/ukudarovv/learning_testing.git aqlant-lms
cd aqlant-lms
python3 -m venv venv
source venv/bin/activate
pip install -U pip setuptools wheel
pip install -r backend/requirements.txt gunicorn
```

## 3. Переменные Django (`backend/.env`)

Скопируйте `backend/.env.example` в `backend/.env` и задайте минимум:

- `SECRET_KEY` — длинная случайная строка
- `DEBUG=False`
- `FRONTEND_URL=https://elearning.aqlant.com`

При других доменах добавьте через запятую (без пробелов):

- `DJANGO_ALLOWED_HOSTS=...`
- `DJANGO_CORS_ALLOWED_ORIGINS=https://...`
- `DJANGO_CSRF_TRUSTED_ORIGINS=https://...,https://...`

## 4. Миграции и статика

```bash
source /home/ubuntu/aqlant-lms/venv/bin/activate
cd /home/ubuntu/aqlant-lms/backend
python manage.py migrate
python manage.py collectstatic --noinput
```

Права на загрузки (медиа):

```bash
sudo chown -R ubuntu:www-data /home/ubuntu/aqlant-lms/backend/media
sudo chmod -R ug+rwX /home/ubuntu/aqlant-lms/backend/media
```

## 5. Пользователь и сокет Gunicorn

Процесс работает как `ubuntu` с группой `www-data`, чтобы nginx мог подключаться к Unix-сокету.

```bash
sudo usermod -aG www-data ubuntu
# перелогиньтесь в SSH, чтобы группа применилась
```

Сервис создаёт каталог `/run/aqlant-api/` с правами `0770` и кладёт туда `gunicorn.sock`.

Установка unit-файла:

```bash
sudo cp /home/ubuntu/aqlant-lms/deploy/server/systemd/aqlant-gunicorn.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now aqlant-gunicorn
sudo systemctl status aqlant-gunicorn
```

Логи:

```bash
journalctl -u aqlant-gunicorn -f
```

Проверка сокета после старта:

```bash
ls -la /run/aqlant-api/
```

Должны быть `gunicorn.sock` и группа `www-data`.

### Если сокет недоступен nginx

- Убедитесь, что сервис активен: `systemctl is-active aqlant-gunicorn`
- Убедитесь, что в unit указаны те же пути, что на сервере (`WorkingDirectory`, `PATH`, `ExecStart`)
- В nginx в `proxy_pass` для unix-сокета обязателен **двоеточие в конце**: `http://unix:/run/aqlant-api/gunicorn.sock:`

## 6. Nginx

```bash
sudo cp /home/ubuntu/aqlant-lms/deploy/server/nginx/api.elearning.aqlant.com.conf /etc/nginx/sites-available/
sudo cp /home/ubuntu/aqlant-lms/deploy/server/nginx/elearning.aqlant.com.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/api.elearning.aqlant.com.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/elearning.aqlant.com.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

TLS:

```bash
sudo certbot --nginx -d api.elearning.aqlant.com -d elearning.aqlant.com
```

## 7. Фронтенд

```bash
cd /home/ubuntu/aqlant-lms/frontend
echo 'VITE_API_URL=https://api.elearning.aqlant.com/api' > .env.production
npm ci
npm run build
```

Проверка: открыть `https://elearning.aqlant.com`, в DevTools запросы к `https://api.elearning.aqlant.com/api/`.

## 8. Альтернатива сокету — HTTP на localhost

Если не хотите возиться с правами сокета, в unit замените `ExecStart` на:

```text
--bind 127.0.0.1:8001
```

и в nginx для API:

```nginx
proxy_pass http://127.0.0.1:8001;
```

## 9. Обновление кода

```bash
cd /home/ubuntu/aqlant-lms && git pull
source venv/bin/activate && pip install -r backend/requirements.txt gunicorn
cd backend && python manage.py migrate && python manage.py collectstatic --noinput
sudo systemctl restart aqlant-gunicorn
# фронт: npm run build при изменении VITE_API_URL или кода
```
