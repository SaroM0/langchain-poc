////////////////////////////////////////////////////
// ORGANIZATION
////////////////////////////////////////////////////
Table organization {
id int [pk, increment, note: "Unique internal identifier for the organization"]
name varchar
created_at datetime
}

////////////////////////////////////////////////////
// SERVER
////////////////////////////////////////////////////
Table server {
id int [pk, increment, note: "Unique internal identifier for the server"]
discord_id bigint [not null, unique, note: "Discord-assigned identifier for the server"]
fk_organization_id int [not null, note: "Foreign key to organization"]
name varchar
description varchar
created_at datetime
}

Ref: server.fk_organization_id > organization.id

////////////////////////////////////////////////////
// USER
////////////////////////////////////////////////////
Table user {
id int [pk, increment, note: "Unique internal identifier for the user"]
discord_id bigint [not null, unique, note: "Discord-assigned identifier for the user"]
fk_server_id int [not null, note: "Foreign key to server"]
nick varchar
name varchar
joined_at datetime [note: "Timestamp when the user joined the server"]
}

Ref: user.fk_server_id > server.id

////////////////////////////////////////////////////
// ROLE
////////////////////////////////////////////////////
Table role {
id int [pk, note: "Unique identifier for the role"]
discord_id bigint [not null, unique, note: "Discord-assigned identifier for the role"]
name varchar
description text
created_at datetime
}

////////////////////////////////////////////////////
// USER_ROLE
////////////////////////////////////////////////////
Table user_role {
id int [pk, increment, note: "Unique identifier for the user-role record"]
fk_user_id int [not null, note: "Foreign key to user"]
fk_role_id int [not null, note: "Foreign key to role"]
assigned_at datetime
}

Ref: user_role.fk_user_id > user.id  
Ref: user_role.fk_role_id > role.id

////////////////////////////////////////////////////
// CHANNEL
////////////////////////////////////////////////////
Table channel {
id int [pk, increment, note: "Unique internal identifier for the channel"]
discord_id bigint [not null, unique, note: "Discord-assigned identifier for the channel"]
fk_server_id int [not null, note: "Foreign key to server"]
name varchar
channel_type varchar [note: "E.g., 'text' or 'forum'"]
created_at datetime
is_indexed boolean [default: false, note: "Indicates if the channel has been indexed in Pinecone"]
}

Ref: channel.fk_server_id > server.id

////////////////////////////////////////////////////
// CHANNEL_USER
////////////////////////////////////////////////////
Table channel_user {
id int [pk, increment, note: "Unique identifier for the channel-user record"]
fk_channel_id int [not null, note: "Foreign key to channel"]
fk_user_id int [not null, note: "Foreign key to user"]
is_featured boolean
joined_at datetime
}

Ref: channel_user.fk_channel_id > channel.id  
Ref: channel_user.fk_user_id > user.id

////////////////////////////////////////////////////
// THREAD
////////////////////////////////////////////////////
Table thread {
id int [pk, increment, note: "Unique identifier for the thread"]
fk_channel_id int [not null, note: "Foreign key to channel"]
discord_id bigint [not null, unique, note: "Discord-assigned identifier for the thread"]
title varchar
description text
created_at datetime
}

Ref: thread.fk_channel_id > channel.id

////////////////////////////////////////////////////
// MESSAGE
////////////////////////////////////////////////////
Table message {
id int [pk, increment, note: "Unique internal identifier for the message"]
discord_id bigint [not null, unique, note: "Discord-assigned identifier for the message"]
fk_channel_id int [not null, note: "Foreign key to channel"]
fk_thread_id int [note: "Optional foreign key if the message is in a thread"]
fk_user_id int [not null, note: "Foreign key to user"]
fk_parent_message_id int [note: "Foreign key indicating reply to another message"]
content text
created_at datetime
is_vectorized boolean [default: false, note: "Indicates if the message has been vectorized"]
}

Ref: message.fk_channel_id > channel.id  
Ref: message.fk_thread_id > thread.id  
Ref: message.fk_user_id > user.id  
Ref: message.fk_parent_message_id > message.id

////////////////////////////////////////////////////
// MESSAGE_ATTACHMENT
////////////////////////////////////////////////////
Table message_attachment {
id int [pk, increment, note: "Unique identifier for the attachment"]
fk_message_id int [not null, note: "Foreign key to message"]
attachment_url text
created_at datetime
}

Ref: message_attachment.fk_message_id > message.id

////////////////////////////////////////////////////
// MESSAGE_REACTION
////////////////////////////////////////////////////
Table message_reaction {
id int [pk, increment, note: "Unique identifier for the reaction"]
fk_message_id int [not null, note: "Foreign key to message"]
fk_user_id int [not null, note: "Foreign key to user"]
reaction_type varchar [note: "For example, 'like', 'love', 'smile', etc."]
created_at datetime
}

Ref: message_reaction.fk_message_id > message.id  
Ref: message_reaction.fk_user_id > user.id

////////////////////////////////////////////////////
// TRENDING_TOPIC
////////////////////////////////////////////////////
Table trending_topic {
id int [pk, note: "Unique identifier for the trending topic"]
fk_channel_id int [not null, note: "Foreign key to channel"]
description varchar
created_at datetime
}

Ref: trending_topic.fk_channel_id > channel.id

////////////////////////////////////////////////////
// MESSAGE_MENTION
////////////////////////////////////////////////////
Table message_mention {
id int [pk, increment, note: "Unique identifier for the mention"]
fk_message_id int [not null, note: "Foreign key to message"]
mention_type varchar [not null, note: "Type of mention: 'user', 'role', 'here', or 'all'"]
target_id bigint [note: "If mention_type is 'user' or 'role', this field stores the corresponding ID; for 'here' or 'all' it is null"]
created_at datetime
}

Ref: message_mention.fk_message_id > message.id
