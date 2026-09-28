INSERT INTO questions (sort_order, text) VALUES
  (1, 'Какой протокол обеспечивает шифрование веб-трафика?'),
  (2, 'Что означает аббревиатура ORM?'),
  (3, 'Сколько байт в одном килобайте по стандарту SI?');

INSERT INTO options (question_id, sort_order, text, correct) VALUES
  (1, 1, 'HTTPS', TRUE),
  (1, 2, 'HTTP', FALSE),
  (1, 3, 'FTP', FALSE),
  (2, 1, 'Object-Relational Mapping', TRUE),
  (2, 2, 'Open Resource Manager', FALSE),
  (3, 1, '1000', TRUE),
  (3, 2, '1024', FALSE),
  (3, 3, '512', FALSE);
