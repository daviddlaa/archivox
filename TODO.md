# TODO - Fix PostgreSQL compatibility in gestorionesMaestro.controller.js

## Task
Refactor the controller to use PostgreSQL-compatible async queries that work in production (both SQLite and PostgreSQL)

## Steps

- [x] 1. Review and understand the issue in controller
- [x] 2. Create plan for refactoring
- [x] 3. Get user confirmation
- [ ] 4. Refactor createGestionMaestro function
- [ ] 5. Refactor updateGestionMaestro function
- [ ] 6. Refactor deleteGestionMaestro function
- [ ] 7. Refactor createGestion function
- [ ] 8. Refactor obtenerProgresoGestion function
- [ ] 9. Test the fix

## Notes
- Use pool.query() with async/await instead of db.prepare().run()
- Use RETURNING id clause instead of lastInsertRowid
- Functions to fix: createGestionMaestro, updateGestionMaestro, deleteGestionMaestro, createGestion, obtenerProgresoGestion
