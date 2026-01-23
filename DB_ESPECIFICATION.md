# ♟️ Especificación de Base de Datos: Reino Ajedrez v1

---

## 🏗️ 1. Núcleo de Usuarios y Acceso

### USERS

| Campo           | Tipo      | Notas                         |
| :-------------- | :-------- | :---------------------------- |
| `id`            | UUID (PK) | Identificador único global    |
| `email`         | String    | Único                         |
| `password_hash` | String    |                               |
| `name`          | String    | Nombre visible                |
| `avatar_url`    | String    | URL de imagen                 |
| `status`        | Enum      | `active`, `banned`, `pending` |
| `last_login_at` | Timestamp |                               |
| `created_at`    | Timestamp |                               |

---

### ROLES (solo sistema / staff)

Roles **no comerciales**, permanentes y manuales.

| Campo  | Tipo      | Notas          |
| :----- | :-------- | :------------- |
| `id`   | UUID (PK) |                |
| `name` | String    | Admin, Teacher |

### USER_ROLES

| Campo     | Tipo        |
| :-------- | :---------- |
| `user_id` | FK -> USERS |
| `role_id` | FK -> ROLES |

---

### PERMISSIONS

Permisos atómicos reutilizables.

| Campo         | Tipo      | Ejemplo                    |
| :------------ | :-------- | :------------------------- |
| `id`          | UUID (PK) |                            |
| `code`        | String    | `course:view`, `live:join` |
| `description` | String    |                            |

---

## 💰 2. Productos, Planes y Monetización

Todos los elementos vendibles se modelan como **PRODUCTS**.

### PRODUCTS

| Campo          | Tipo      | Notas                           |
| :------------- | :-------- | :------------------------------ |
| `id`           | UUID (PK) |                                 |
| `name`         | String    | Free, Student, Premium, Curso X |
| `product_type` | Enum      | `plan`, `course`                |
| `is_active`    | Boolean   |                                 |

---

### PRODUCT_PERMISSIONS

Permisos otorgados por un **plan**.

| Campo           | Tipo              |
| :-------------- | :---------------- |
| `product_id`    | FK -> PRODUCTS    |
| `permission_id` | FK -> PERMISSIONS |

> Solo aplica si `product_type = plan`

---

### COURSE_PLANS

Qué cursos están incluidos en qué planes.

| Campo        | Tipo                  |
| :----------- | :-------------------- |
| `course_id`  | FK -> COURSES         |
| `product_id` | FK -> PRODUCTS (plan) |

---

## 🧩 3. Entitlements (Fuente Única de Verdad)

### USER_ENTITLEMENTS

Tabla maestra de control de acceso.

| Campo           | Tipo        | Notas                           |
| :-------------- | :---------- | :------------------------------ |
| `id`            | UUID (PK)   |                                 |
| `user_id`       | FK -> USERS |                                 |
| `resource_type` | Enum        | `plan`, `course`                |
| `resource_id`   | UUID        | FK lógico a PRODUCTS            |
| `access_mode`   | Enum        | `lifetime`, `subscription`      |
| `starts_at`     | Timestamp   |                                 |
| `expires_at`    | Timestamp   | NULL si es vitalicio            |
| `source_type`   | Enum        | `payment`, `admin`, `migration` |
| `source_id`     | UUID        | payment_id o NULL               |

---

## 💳 4. Sistema de Transacciones

### ORDERS

Intención de compra.

| Campo          | Tipo                                                  |
| :------------- | :---------------------------------------------------- |
| `id`           | UUID (PK)                                             |
| `user_id`      | FK -> USERS                                           |
| `status`       | Enum (`pending`, `completed`, `cancelled`, `expired`) |
| `total_amount` | Decimal                                               |
| `currency`     | String                                                |
| `created_at`   | Timestamp                                             |
| `completed_at` | Timestamp                                             |

---

### ORDER_ITEMS

Productos incluidos en la orden.

| Campo         | Tipo           |
| :------------ | :------------- |
| `id`          | UUID (PK)      |
| `order_id`    | FK -> ORDERS   |
| `product_id`  | FK -> PRODUCTS |
| `quantity`    | Integer        |
| `unit_price`  | Decimal        |
| `total_price` | Decimal        |

---

### PAYMENTS

Cada intento real de pago.

| Campo                 | Tipo                                                                      |
| :-------------------- | :------------------------------------------------------------------------ |
| `id`                  | UUID (PK)                                                                 |
| `order_id`            | FK -> ORDERS                                                              |
| `gateway_name`        | String                                                                    |
| `external_payment_id` | String                                                                    |
| `amount`              | Decimal                                                                   |
| `currency`            | String                                                                    |
| `status`              | Enum (`pending`, `completed`, `failed`, `refunded`, `partially_refunded`) |
| `paid_at`             | Timestamp                                                                 |
| `metadata`            | JSONB                                                                     |

---

### PAYMENT_EVENTS

Auditoría completa de pasarelas.

| Campo         | Tipo           |
| :------------ | :------------- |
| `id`          | UUID (PK)      |
| `payment_id`  | FK -> PAYMENTS |
| `event_type`  | String         |
| `raw_payload` | JSONB          |
| `created_at`  | Timestamp      |

---

### SUBSCRIPTIONS

Solo para productos recurrentes.

| Campo                      | Tipo                                              |
| :------------------------- | :------------------------------------------------ |
| `id`                       | UUID (PK)                                         |
| `user_id`                  | FK -> USERS                                       |
| `product_id`               | FK -> PRODUCTS                                    |
| `gateway_name`             | String                                            |
| `external_subscription_id` | String                                            |
| `status`                   | Enum (`active`, `paused`, `cancelled`, `expired`) |
| `current_period_start`     | Timestamp                                         |
| `current_period_end`       | Timestamp                                         |

---

## 📚 5. Contenido Educativo

### COURSES

* `id`: UUID (PK)
* `title`: String
* `slug`: String
* `level`: Enum (`beginner`, `intermediate`, `advanced`)
* `is_published`: Boolean

### MODULES

* `id`: UUID (PK)
* `course_id`: FK -> COURSES
* `title`: String
* `order_index`: Integer

### LESSONS

* `id`: UUID (PK)
* `module_id`: FK -> MODULES
* `title`: String
* `lesson_type`: Enum (`video`, `article`, `interactive_board`)
* `content_md`: Text
* `video_url`: String
* `order_index`: Integer

### USER_PROGRESS

* `user_id`: FK -> USERS
* `lesson_id`: FK -> LESSONS
* `status`: Enum (`started`, `completed`)
* `completed_at`: Timestamp

---