-- Deshabilitar la verificación de claves foráneas para evitar errores al eliminar las tablas
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS trending_topic;
DROP TABLE IF EXISTS message_reaction;
DROP TABLE IF EXISTS message_attachment;
DROP TABLE IF EXISTS message_mention;
DROP TABLE IF EXISTS message;
DROP TABLE IF EXISTS thread;
DROP TABLE IF EXISTS channel;
DROP TABLE IF EXISTS channel_user;
DROP TABLE IF EXISTS user_role;
DROP TABLE IF EXISTS role;
DROP TABLE IF EXISTS `user`;
DROP TABLE IF EXISTS server;
DROP TABLE IF EXISTS organization;

SET FOREIGN_KEY_CHECKS = 1;

----------------------------------------------------
-- Creación de la nueva versión de la base de datos
----------------------------------------------------

-- Table ORGANIZATION
CREATE TABLE organization (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    created_at DATETIME
);

-- Table SERVER
CREATE TABLE server (
    id INT AUTO_INCREMENT PRIMARY KEY,
    discord_id BIGINT NOT NULL UNIQUE,
    fk_organization_id INT NOT NULL,
    name VARCHAR(255),
    description VARCHAR(255),
    created_at DATETIME,
    CONSTRAINT fk_server_organization FOREIGN KEY (fk_organization_id)
      REFERENCES organization(id)
);

-- Table USER
CREATE TABLE `user` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    discord_id BIGINT NOT NULL UNIQUE,
    fk_server_id INT NOT NULL,
    nick VARCHAR(255),
    name VARCHAR(255),
    joined_at DATETIME COMMENT 'Date the user joined the server',
    CONSTRAINT fk_user_server FOREIGN KEY (fk_server_id)
      REFERENCES server(id)
);

-- Table ROLE
CREATE TABLE role (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    description TEXT,
    created_at DATETIME
);

-- Table USER_ROLE
CREATE TABLE user_role (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fk_user_id INT NOT NULL,
    fk_role_id INT NOT NULL,
    assigned_at DATETIME,
    CONSTRAINT fk_user_role_user FOREIGN KEY (fk_user_id)
      REFERENCES `user`(id),
    CONSTRAINT fk_user_role_role FOREIGN KEY (fk_role_id)
      REFERENCES role(id)
);

-- Table CHANNEL
CREATE TABLE channel (
    id INT AUTO_INCREMENT PRIMARY KEY,
    discord_id BIGINT NOT NULL UNIQUE,
    fk_server_id INT NOT NULL,
    name VARCHAR(255),
    channel_type VARCHAR(50) COMMENT 'Example: ''text'' or ''forum''',
    created_at DATETIME,
    is_indexed BOOLEAN DEFAULT false,
    CONSTRAINT fk_channel_server FOREIGN KEY (fk_server_id)
      REFERENCES server(id)
);

-- Table CHANNEL_USER
CREATE TABLE channel_user (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fk_channel_id INT NOT NULL,
    fk_user_id INT NOT NULL,
    is_featured BOOLEAN,
    joined_at DATETIME,
    CONSTRAINT fk_channel_user_channel FOREIGN KEY (fk_channel_id)
      REFERENCES channel(id),
    CONSTRAINT fk_channel_user_user FOREIGN KEY (fk_user_id)
      REFERENCES `user`(id)
);

-- Table THREAD
CREATE TABLE thread (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fk_channel_id INT NOT NULL,
    discord_id BIGINT NOT NULL UNIQUE,
    title VARCHAR(255),
    description TEXT,
    created_at DATETIME,
    CONSTRAINT fk_thread_channel FOREIGN KEY (fk_channel_id)
      REFERENCES channel(id)
);

-- Table MESSAGE
CREATE TABLE message (
    id INT AUTO_INCREMENT PRIMARY KEY,
    discord_id BIGINT NOT NULL UNIQUE,
    fk_channel_id INT NOT NULL,
    fk_thread_id INT,
    fk_user_id INT NOT NULL,
    fk_parent_message_id INT,
    content TEXT,
    created_at DATETIME,
    is_vectorized BOOLEAN DEFAULT false,
    CONSTRAINT fk_message_channel FOREIGN KEY (fk_channel_id)
      REFERENCES channel(id),
    CONSTRAINT fk_message_thread FOREIGN KEY (fk_thread_id)
      REFERENCES thread(id),
    CONSTRAINT fk_message_user FOREIGN KEY (fk_user_id)
      REFERENCES `user`(id),
    CONSTRAINT fk_message_parent FOREIGN KEY (fk_parent_message_id)
      REFERENCES message(id)
);

-- Table MESSAGE_ATTACHMENT
CREATE TABLE message_attachment (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fk_message_id INT NOT NULL,
    attachment_url TEXT,
    created_at DATETIME,
    CONSTRAINT fk_message_attachment_message FOREIGN KEY (fk_message_id)
      REFERENCES message(id)
);

-- Table MESSAGE_REACTION
CREATE TABLE message_reaction (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fk_message_id INT NOT NULL,
    fk_user_id INT NOT NULL,
    reaction_type VARCHAR(50) COMMENT 'For example, ''like'', ''love'', ''smile'', etc.',
    created_at DATETIME,
    CONSTRAINT fk_message_reaction_message FOREIGN KEY (fk_message_id)
      REFERENCES message(id),
    CONSTRAINT fk_message_reaction_user FOREIGN KEY (fk_user_id)
      REFERENCES `user`(id)
);

-- Table TRENDING_TOPIC
CREATE TABLE trending_topic (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fk_channel_id INT NOT NULL,
    description VARCHAR(255),
    created_at DATETIME,
    CONSTRAINT fk_trending_topic_channel FOREIGN KEY (fk_channel_id)
      REFERENCES channel(id)
);

-- Table MESSAGE_MENTION
CREATE TABLE message_mention (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fk_message_id INT NOT NULL,
    mention_type VARCHAR(50) NOT NULL COMMENT 'Type of mention: ''user'', ''role'', ''here'' or ''all''',
    target_id BIGINT COMMENT 'If mention_type is ''user'' or ''role'', this field stores the corresponding ID; for ''here'' or ''all'' it is NULL',
    created_at DATETIME,
    CONSTRAINT fk_message_mention_message FOREIGN KEY (fk_message_id)
      REFERENCES message(id)
);
