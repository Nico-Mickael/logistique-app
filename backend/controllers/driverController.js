const { Sortie, Vehicle, Request, SortieRequest, Employee } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { notifyChiefs } = require('../services/socketService');
const vehicleService = require('../services/vehicleService');

// Vérifie côté serveur (en rechargeant l'utilisateur depuis la DB) que :
//  - l'utilisateur connecté a bien le rôle 'chauffeur'
//  - il est bien le chauffeur affecté à cette sortie (driver_employee_id)
async function assertDriver(req, sortieId) {
  const dbUser = await Employee.findByPk(req.user.id);
  if (!dbUser) {
    const err = new Error('Utilisateur introuvable');
    err.status = 401;
    throw err;
  }
  if (dbUser.role !== 'chauffeur') {
    const err = new Error('Accès refusé : seul un chauffeur peut effectuer cette action');
    err.status = 403;
    throw err;
  }
  if (!sortieId) {
    return dbUser;
  }
  const sortie = await Sortie.findByPk(sortieId, { include: [Vehicle] });
  if (!sortie) {
    const err = new Error('Sortie introuvable');
    err.status = 404;
    throw err;
  }
  if (sortie.driver_employee_id !== dbUser.id) {
    const err = new Error('Cette sortie ne vous est pas affectée en tant que chauffeur');
    err.status = 403;
    throw err;
  }
  return { dbUser, sortie };
}

// Liste les sorties affectées au chauffeur connecté
exports.mine = asyncHandler(async (req, res) => {
  const dbUser = await assertDriver(req, null);

  const sorties = await Sortie.findAll({
    where: { driver_employee_id: dbUser.id },
    include: [
      Vehicle,
      { model: Request, through: { attributes: ['departure_km', 'return_km', 'distance_km', 'status', 'returned_at'] }, include: [Employee] },
    ],
    order: [['departure_time', 'DESC']],
  });

  res.json(sorties);
});

// Démarrage : le chauffeur saisit le km de départ
exports.depart = asyncHandler(async (req, res) => {
  const { departure_km } = req.body;
  const { dbUser, sortie } = await assertDriver(req, req.params.id);

  if (sortie.status !== 'planned') {
    return res.status(400).json({ message: 'Seules les sorties planifiées peuvent démarrer' });
  }
  if (sortie.departure_km !== null && sortie.departure_km !== undefined) {
    return res.status(400).json({ message: 'Le kilométrage de départ a déjà été saisi' });
  }
  const km = Number(departure_km);
  if (!km || km <= 0) {
    return res.status(400).json({ message: 'Saisissez un kilométrage de départ valide supérieur à 0' });
  }

  sortie.departure_km = km;
  sortie.departed_at = new Date();
  sortie.status = 'ongoing';
  await sortie.save();

  // Synchronise les demandes liées
  await SortieRequest.update(
    { status: 'ongoing' },
    { where: { sortie_id: sortie.id } }
  );

  notifyChiefs('sortie_updated', sortie);

  res.json(sortie);
});

// Arrivée : le chauffeur saisit le km d'arrivée, dist calculée, sortie terminée
exports.arrivee = asyncHandler(async (req, res) => {
  const { arrival_km } = req.body;
  const { dbUser, sortie } = await assertDriver(req, req.params.id);

  if (sortie.status !== 'ongoing') {
    return res.status(400).json({ message: 'Seules les sorties en cours peuvent enregistrer l\'arrivée' });
  }
  if (sortie.departure_km === null || sortie.departure_km === undefined) {
    return res.status(400).json({ message: 'Le kilométrage de départ doit être renseigné' });
  }
  if (sortie.arrival_km !== null && sortie.arrival_km !== undefined) {
    return res.status(400).json({ message: 'Le kilométrage d\'arrivée a déjà été saisi' });
  }
  const km = Number(arrival_km);
  if (!km || km < sortie.departure_km) {
    return res.status(400).json({ message: 'Le kilométrage d\'arrivée ne peut pas être inférieur au kilométrage de départ' });
  }

  sortie.arrival_km = km;
  sortie.distance_km = km - sortie.departure_km;
  sortie.status = 'finished';
  await sortie.save();

  // Synchronise les demandes liées : elles sont terminées avec la sortie
  await SortieRequest.update(
    { status: 'finished' },
    { where: { sortie_id: sortie.id } }
  );

  // Libère le véhicule
  await vehicleService.setAvailable(sortie.vehicle_id);

  notifyChiefs('sortie_updated', sortie);

  res.json(sortie);
});
