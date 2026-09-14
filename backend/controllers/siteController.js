const asyncHandler = require('../utils/asyncHandler');
const { Site, Employee, Vehicle, Request, Sortie } = require('../models');
const { Op } = require('sequelize');

// Liste des sites (tout utilisateur connecté) — affichage "Site actuel" / sélecteur
exports.list = asyncHandler(async (req, res) => {
  const sites = await Site.findAll({
    attributes: ['id', 'name', 'code', 'city', 'address', 'status', 'createdAt', 'updatedAt'],
    order: [['name', 'ASC']],
  });
  res.json(sites);
});

// CRUD réservé au Superadmin
exports.create = asyncHandler(async (req, res) => {
  const { name, code, city, address, status } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Le nom du site est obligatoire' });
  }
  if (!code || !String(code).trim()) {
    return res.status(400).json({ message: 'Le code du site est obligatoire (ex. TANA)' });
  }
  const normalizedCode = String(code).trim().toUpperCase();

  const existing = await Site.findOne({ where: { code: { [Op.iLike]: normalizedCode } } });
  if (existing) {
    return res.status(400).json({ message: 'Un site avec ce code existe déjà' });
  }

  const site = await Site.create({
    name: String(name).trim(),
    code: normalizedCode,
    city: city || null,
    address: address || null,
    status: status === 'inactive' ? 'inactive' : 'active',
  });

  res.status(201).json(site);
});

exports.update = asyncHandler(async (req, res) => {
  const site = await Site.findByPk(req.params.id);
  if (!site) return res.status(404).json({ message: 'Site introuvable' });

  const { name, code, city, address, status } = req.body;

  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ message: 'Le nom du site ne peut pas être vide' });
  }
  if (code !== undefined && String(code).trim()) {
    const normalizedCode = String(code).trim().toUpperCase();
    const existing = await Site.findOne({
      where: { code: { [Op.iLike]: normalizedCode }, id: { [Op.ne]: site.id } },
    });
    if (existing) {
      return res.status(400).json({ message: 'Un site avec ce code existe déjà' });
    }
    site.code = normalizedCode;
  }

  if (name !== undefined) site.name = String(name).trim();
  if (city !== undefined) site.city = city;
  if (address !== undefined) site.address = address;
  if (status !== undefined) {
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Statut invalide' });
    }
    // On ne peut pas désactiver le dernier site actif (évite un système sans aucun site).
    if (status === 'inactive' && site.status === 'active') {
      const activeCount = await Site.count({ where: { status: 'active' } });
      if (activeCount <= 1) {
        return res.status(400).json({ message: 'Impossible de désactiver le dernier site actif' });
      }
    }
    site.status = status;
  }

  await site.save();
  res.json(site);
});

exports.remove = asyncHandler(async (req, res) => {
  const site = await Site.findByPk(req.params.id);
  if (!site) return res.status(404).json({ message: 'Site introuvable' });

  // Protéger le site par défaut Tana (créé par la migration de rattachement).
  if (site.code === 'TANA') {
    return res.status(400).json({ message: 'Le site par défaut ne peut pas être supprimé' });
  }

  const [employees, vehicles, requests, sorties] = await Promise.all([
    Employee.count({ where: { site_id: site.id } }),
    Vehicle.count({ where: { site_id: site.id } }),
    Request.count({ where: { site_id: site.id } }),
    Sortie.count({ where: { site_id: site.id } }),
  ]);
  if (employees + vehicles + requests + sorties > 0) {
    return res.status(400).json({
      message: 'Impossible de supprimer un site contenant des données (utilisateurs, véhicules, demandes ou sorties). Désactivez-le ou déplacez ses données.',
    });
  }

  await site.destroy();
  res.json({ message: 'Site supprimé' });
});