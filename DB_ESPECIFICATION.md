# ♟️ Especificación de Base de Datos: Reino Ajedrez v1

Este documento contiene la estructura técnica final de la base de datos. Diseñada para ser escalable y con un seguimiento educativo profundo.

---

## 🏗️ 1. Núcleo de Usuarios y Acceso

### USERS
| Campo | Tipo | Notas |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Identificador único global. |
| `email` | String | Único. |
| `password_hash` | String | |
| `name` | String | Nombre visible. |
| `avatar_url` | String | URL de imagen. |
| `status` | Enum | `active`, `banned`, `pending`. |
| `last_login_at` | Timestamp | |
| `created_at` | Timestamp | |


### ROLES & PERMISSIONS
- **ROLES**: `id`, `name` (Admin, Coach, Student), role_type (admin, membership).
- **PERMISSIONS**: `id`, `code` (ej: `course:edit`), `description`.
- **ROLE_PERMISSIONS**: `role_id`, `permission_id`.
- **USER_ROLES**: `user_id`, `role_id`.

### 💡 Lógica de Permisos Híbrida

Para maximizar la flexibilidad, el sistema de permisos evalúa la unión de dos fuentes:

1. **Permisos Estáticos**: Definidos en `USER_ROLES`. Orientados a la gestión del staff (Admin, Coach).
2. **Permisos Dinámicos (Entitlements)**: Definidos en `USER_ENTITLEMENTS`. Orientados a la monetización. 
   - Si el `resource_type` es `role`, el usuario "hereda" temporalmente todos los permisos asociados a ese rol mientras la suscripción esté vigente.
   - Si el `resource_type` es `course`, el usuario obtiene permiso exclusivo sobre ese ID de curso específico de forma vitalicia.
   
---

## 💰 2. Monetización (Productos y Acceso)

Esta sección gestiona la oferta comercial y los derechos de acceso otorgados a los usuarios. El sistema está diseñado para ser independiente de la pasarela de pago, utilizando un modelo de **Entitlements (Derechos)** para centralizar permisos.

### PRODUCTS
*El catálogo de ofertas comerciales de la plataforma.*
| Campo | Tipo | Notas |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Identificador único del producto. |
| `name` | String | Nombre comercial (ej: "Plan Maestro", "Curso de Finales"). |
| `product_type` | Enum | `course_lifetime`, `subscription`, `bundle`. |
| `price` | Decimal | Precio base. |
| `currency` | String | Código de moneda (EUR, USD, etc.). |
| `external_reference` | String | ID del producto/precio en la pasarela externa (opcional). |
| `is_active` | Boolean | Estado de disponibilidad en la tienda. |

### PRODUCT_RESOURCES
*Define qué contenido o qué rol otorga cada producto al ser adquirido.*
| Campo | Tipo | Notas |
| :--- | :--- | :--- |
| `id` | UUID (PK) | |
| `product_id` | FK -> PRODUCTS | El producto que se pone a la venta. |
| `resource_type` | Enum | `course`, `role`. |
| `resource_id` | UUID | ID de la tabla `COURSES` o de la tabla `ROLES`. |

### USER_ENTITLEMENTS
*Tabla maestra de control de acceso. Determina qué puede usar el usuario hoy.*
| Campo | Tipo | Notas |
| :--- | :--- | :--- |
| `id` | UUID (PK) | |
| `user_id` | FK -> USERS | |
| `resource_type` | Enum | `course`, `role`. |
| `resource_id` | UUID | El ID del recurso al que tiene derecho. |
| `access_mode` | Enum | `lifetime` (permanente), `subscription` (temporal). |
| `starts_at` | Timestamp | Inicio del derecho de acceso. |
| `expires_at` | Timestamp | NULL si es vitalicio; fecha límite si es temporal. |

### TRANSACTIONS
*Registro histórico de pagos procesados.*
| Campo | Tipo | Notas |
| :--- | :--- | :--- |
| `id` | UUID (PK) | |
| `user_id` | FK -> USERS | |
| `product_id` | FK -> PRODUCTS | |
| `gateway_name` | String | Ej: "stripe", "paypal", "manual_transfer". |
| `external_tx_id` | String | ID de transacción de la pasarela externa. |
| `amount_paid` | Decimal | Monto final neto. |
| `status` | Enum | `completed`, `refunded`, `failed`, `pending`. |
| `created_at` | Timestamp | |

---

### 💡 Lógica de Implementación Genérica

1. **Jerarquía de Permisos**: Para verificar si un usuario puede acceder a una lección, el sistema consulta si existe un `USER_ENTITLEMENT` activo para ese `course_id` específico o si el usuario tiene un `role_id` activo que le otorga permisos globales (definidos en la Sección 1).
2. **Independencia de Pagos**: La tabla `TRANSACTIONS` actúa como un log de auditoría. Una vez que una transacción cambia a estado `completed` (ya sea por un webhook automático o una validación manual), el sistema dispara la creación de los registros correspondientes en `USER_ENTITLEMENTS`.
3. **Suscripciones**: Se gestionan estableciendo una `expires_at`. Al procesar un nuevo pago recurrente, simplemente se actualiza dicha fecha en el registro de derecho existente.

---

## 📚 3. Contenido y Progreso Educativo

### COURSES
- `id`: UUID (PK)
- `title`: String.
- `slug`: String (URL amigable).
- `level`: Enum (`beginner`, `intermediate`, `advanced`).
- `is_published`: Boolean.

### MODULES
- `id`: UUID (PK)
- `course_id`: FK -> COURSES.
- `title`: String.
- `order_index`: Integer.

### LESSONS
- `id`: UUID (PK)
- `module_id`: FK -> MODULES.
- `title`: String.
- `lesson_type`: Enum (`video`, `article`, `interactive_board`).
- `content_md`: Text (Soporta Markdown).
- `video_url`: String (Opcional).
- `order_index`: Integer.

### USER_PROGRESS
- `user_id`: FK -> USERS.
- `lesson_id`: FK -> LESSONS.
- `status`: Enum (`started`, `completed`).
- `completed_at`: Timestamp.

---

## 🧩 4. Sistema de Puzzles (Entrenamiento)

### PUZZLES
- `id`: UUID (PK)
- `external_id`: String (ID de Lichess/otros).
- `initial_fen`: String (Posición de inicio).
- `solution_moves`: JSONB (Lista de movimientos correctos).
- `rating`: Integer (ELO del puzzle).
- `themes`: JSONB (Ej: `["mateIn2", "fork"]`).

### PUZZLE_ATTEMPTS
- `id`: UUID (PK)
- `user_id`: FK -> USERS.
- `puzzle_id`: FK -> PUZZLES.
- `solved`: Boolean.
- `time_spent`: Integer (segundos).
- `rating_delta`: Integer (Cuánto subió/bajó el ELO del usuario).

---

## 🎥 5. Clases en Vivo y Grupos

### GROUPS
- `id`: UUID (PK)
- `name`: String.
- `teacher_id`: FK -> USERS.
- `level_tag`: String.

### 🆕 GROUP_MEMBERS
- `group_id`: FK -> GROUPS.
- `user_id`: FK -> USERS.
- `joined_at`: Timestamp.

### LIVE_CLASSES
- `id`: UUID (PK)
- `title`: String.
- `teacher_id`: FK -> USERS.
- `scheduled_at`: Timestamp.
- `duration_mins`: Integer.
- `room_url`: String.
- `status`: Enum (`scheduled`, `live`, `finished`).

### LIVE_ATTENDANCE
- `live_class_id`: FK.
- `user_id`: FK.
- `joined_at`: Timestamp.

---

## 🛠️ 6. Auditoría y Logs (Tablas Técnicas)

### ACTIVITY_LOG
- `id`: UUID.
- `user_id`: FK.
- `action`: String (ej: "LOGIN", "PURCHASE_COURSE").
- `metadata`: JSONB.
