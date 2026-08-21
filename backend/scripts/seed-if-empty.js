/**
 * Exécute les seeds uniquement si la base est vide (première initialisation).
 * Les redémarrages suivants préservent les données.
 *
 * Pour réinitialiser avec les données de démo :
 *   docker-compose exec backend npx sequelize-cli db:seed:all
 */
const { execSync } = require('child_process');
const { sequelize, Employee } = require('../models');

async function main() {
  await sequelize.authenticate();

  const count = await Employee.count();
  if (count > 0) {
    console.log(`[seed] Base déjà initialisée (${count} utilisateur(s)) → seeds ignorés`);
    return;
  }

  console.log('[seed] Base vide → exécution des seeds...');
  execSync('npx sequelize-cli db:seed:all', { stdio: 'inherit', cwd: __dirname + '/..' });
  console.log('[seed] Terminé');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed] Erreur :', err.message);
    process.exit(1);
  });
