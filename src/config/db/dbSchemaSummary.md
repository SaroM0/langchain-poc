////////////////////////////////////////////////////
// ORGANIZATION //
////////////////////////////////////////////////////
Table organization {
id int [pk, increment, note: "Identificador único interno de la organización"]
name varchar
created_at datetime
}

////////////////////////////////////////////////////
// SERVER //
////////////////////////////////////////////////////
Table server {
id int [pk, increment, note: "Identificador único interno del servidor"]
discord_id bigint [not null, unique, note: "Identificador asignado por Discord para el servidor"]
fk_organization_id int [not null, note: "FK hacia organization"]
name varchar
description varchar
created_at datetime
}

Ref: server.fk_organization_id > organization.id

////////////////////////////////////////////////////
// USER //
////////////////////////////////////////////////////
Table user {
id int [pk, increment, note: "Identificador único interno del usuario"]
discord_id bigint [not null, unique, note: "Identificador asignado por Discord para el usuario"]
fk_server_id int [not null, note: "FK hacia server"]
nick varchar
name varchar
joined_at datetime [note: "Fecha en la que el usuario entró al servidor"]
}

Ref: user.fk_server_id > server.id

////////////////////////////////////////////////////
// ROLE //
////////////////////////////////////////////////////
Table role {
id int [pk, note: "Identificador único del rol"]
name varchar
description text
created_at datetime
}

////////////////////////////////////////////////////
// USER_ROLE //
////////////////////////////////////////////////////
Table user_role {
id int [pk, increment, note: "Identificador único del registro"]
fk_user_id int [not null, note: "FK hacia user"]
fk_role_id int [not null, note: "FK hacia role"]
assigned_at datetime
}

Ref: user_role.fk_user_id > user.id
Ref: user_role.fk_role_id > role.id

////////////////////////////////////////////////////
// CHANNEL //
////////////////////////////////////////////////////
Table channel {
id int [pk, increment, note: "Identificador único interno del canal"]
discord_id bigint [not null, unique, note: "Identificador asignado por Discord para el canal"]
fk_server_id int [not null, note: "FK hacia server"]
name varchar
channel_type varchar [note: "Ejemplo: 'text' o 'forum'"]
created_at datetime
}

Ref: channel.fk_server_id > server.id

////////////////////////////////////////////////////
// CHANNEL_USER //
////////////////////////////////////////////////////
Table channel_user {
id int [pk, increment, note: "Identificador único del registro"]
fk_channel_id int [not null, note: "FK hacia channel"]
fk_user_id int [not null, note: "FK hacia user"]
is_featured boolean
joined_at datetime
}

Ref: channel_user.fk_channel_id > channel.id
Ref: channel_user.fk_user_id > user.id

////////////////////////////////////////////////////
// THREAD //
////////////////////////////////////////////////////
Table thread {
id int [pk, increment, note: "Identificador único del thread"]
fk_channel_id int [not null, note: "FK hacia channel"]
discord_id bigint [not null, unique, note: "Identificador asignado por Discord para el thread"]
title varchar
description text
created_at datetime
}

Ref: thread.fk_channel_id > channel.id

////////////////////////////////////////////////////
// MESSAGE //
////////////////////////////////////////////////////
Table message {
id int [pk, increment, note: "Identificador único interno del mensaje"]
discord_id bigint [not null, unique, note: "Identificador asignado por Discord para el mensaje"]
fk_channel_id int [not null, note: "FK hacia channel"]
fk_thread_id int [note: "FK opcional si el mensaje está dentro de un thread"]
fk_user_id int [not null, note: "FK hacia user"]
fk_parent_message_id int [note: "FK para indicar respuesta a otro mensaje"]
content text
created_at datetime
}

Ref: message.fk_channel_id > channel.id
Ref: message.fk_thread_id > thread.id
Ref: message.fk_user_id > user.id
Ref: message.fk_parent_message_id > message.id

////////////////////////////////////////////////////
// MESSAGE_ATTACHMENT //
////////////////////////////////////////////////////
Table message_attachment {
id int [pk, increment, note: "Identificador único del attachment"]
message_id int [not null, note: "FK hacia message"]
attachment_url text
created_at datetime
}

Ref: message_attachment.message_id > message.id

////////////////////////////////////////////////////
// MESSAGE_REACTION //
////////////////////////////////////////////////////
Table message_reaction {
id int [pk, increment, note: "Identificador único de la reacción"]
fk_message_id int [not null, note: "FK hacia message"]
fk_user_id int [not null, note: "FK hacia user"]
reaction_type varchar [note: "Por ejemplo, 'like', 'love', 'smile', etc."]
created_at datetime
}

Ref: message_reaction.fk_message_id > message.id
Ref: message_reaction.fk_user_id > user.id

////////////////////////////////////////////////////
// TRENDING_TOPIC //
////////////////////////////////////////////////////
Table trending_topic {
id int [pk, note: "Identificador único del trending topic"]
fk_channel_id int [not null, note: "FK hacia channel"]
description varchar
created_at datetime
}

Ref: trending_topic.fk_channel_id > channel.id

////////////////////////////////////////////////////
// MESSAGE_MENTION //
////////////////////////////////////////////////////
Table message_mention {
id int [pk, increment, note: "Identificador único de la mención"]
fk_message_id int [not null, note: "FK hacia message"]
mention_type varchar [not null, note: "Tipo de mención: 'user', 'role', 'here' o 'all'"]
target_id bigint [note: "Si mention_type es 'user' o 'role', este campo almacena el id correspondiente; para 'here' o 'all' se deja en null"]
created_at datetime
}

Ref: message_mention.fk_message_id > message.id
