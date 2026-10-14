-- Référentiel des niveaux pré-rempli (SPECS.md §3.5 bis) : niveaux Galaxie puis niveaux adultes.
-- Liste identique à DEFAULT_LEVELS (src/domain/levels.ts). Les UUID sont fixes pour que toutes
-- les bases partagent les mêmes identifiants de niveaux par défaut.
INSERT INTO `levels` (`id`, `label`, `sort_order`) VALUES
	('860b9a5b-2a50-4fc9-8a62-bbd4cdadaa25', 'Galaxie blanc', 0),
	('055bb616-7693-4c3a-9856-bc63392474e8', 'Galaxie violet', 1),
	('fd3e62be-d45b-4fec-8b0a-fe7b5cb37c70', 'Galaxie rouge', 2),
	('9e3dd810-0a9e-48c8-a867-e6ff7df72daa', 'Galaxie orange', 3),
	('600b8b52-942f-4da6-ad95-aefc77227b7a', 'Galaxie vert', 4),
	('da3bd2f2-f300-4eaa-9fd3-825eab29c342', 'Galaxie jaune', 5),
	('1cbbab97-e4ba-417e-896d-06fe8378ca88', 'Débutant', 6),
	('b9133e0e-0cb7-432a-81cb-9adc2e9fec8e', 'Intermédiaire', 7),
	('71dff435-fbe1-45cb-98b7-e6a4cd87611f', 'Confirmé', 8),
	('98a0358d-5027-49da-aaae-50f3fadc649c', 'Compétition', 9);
