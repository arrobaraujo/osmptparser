## v2.3.0 (2026-04-20)

**Modificado por Antigravity AI (em nome do Usuário)**

 - Adicionado: Aplicação Web Visualizer no diretório `webapp/`.
 - Adicionado: Visualização baseada em navegador para relações OSM com detecção de gaps.
 - Adicionado: Integração com Overpass API para análise em tempo real.
 - Adicionado: Integração com Controle Remoto do JOSM.

## v2.2.0

Added filtering by negation

 - Added: Filtering accepts negation with `!` before the key.
 - Fixed: new_ptv2 was not getting the public transport relations.

## v2.1.0

Added minor features

 - Added: Filtering accepts multiple valid values separated by commas.
 - Added: Also returning osm_type (r/w/n) together with osm_id in the JSON.
 - Fixed: JSON output is now valid JSON.

## v2.0.0

Added generic filtering

 - Added new CLI
 - Added parameter to filter with any key=value of osm tags
 - Added: Parser::get_areas(tolerance)
 - Modified: struct relation::AdministrativeArea to relation::Area

## v1.3.0 (unreleased)

Added Administrative areas parsing

 - Added: struct relation::AdministrativeArea
 - Added: Parser::get_administrative_areas()
 - Added: Parser::new_aa()

## v1.2.2

Maintenance fix

 - Fixed issue when osm data is buggy. Relation without ways

## v1.2.0

Added info HashMap to expose public transport relation metadata

 - Added: info HashMap attribute to PublicTransport struct

## v1.1.0

Added status struct to know if the parser applied workarounds

 - Added: struct parse_status::ParseStatus
 - Added: parse_status attribute to PublicTransport struct

## v1.0.0

First functional version.

 - Added: struct relation::PublicTransport
 - Added: struct relation::Relation
 - Added: struct Parser
 - Added: struct ParserRelationIterator
