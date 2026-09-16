const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Use process.env before requiring availabilityService to prevent it loading models prematurely.
const availabilityService = require('../services/availabilityService');

const { effectiveStatus, isAssignable, autoRevertLeaves, toDayStr, __setDeps, __resetDeps } = availabilityService;

function day(y, m, d) {
  return new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T10:00:00`);
}

// fakeModels abstrait pour autoRevertLeaves (vérifie les appels).
function createFakeModel() {
  return {
    updates: [],
    async update(values, opts) { this.updates.push({ values, opts }); return [0, []]; },
  };
}

describe('availabilityService', () => {
  beforeEach(() => { __resetDeps(); });

  it('effectiveStatus : par défaut available', () => {
    const emp = { availability_status: 'available' };
    assert.strictEqual(effectiveStatus(emp), 'available');
  });

  it('effectiveStatus : offline reste offline', () => {
    const emp = { availability_status: 'offline' };
    assert.strictEqual(effectiveStatus(emp), 'offline');
  });

  it('effectiveStatus : absent reste absent', () => {
    const emp = { availability_status: 'absent' };
    assert.strictEqual(effectiveStatus(emp), 'absent');
  });

  it('effectiveStatus : on_leave sans dates reste on_leave', () => {
    const emp = { availability_status: 'on_leave' };
    assert.strictEqual(effectiveStatus(emp), 'on_leave');
  });

  it('effectiveStatus : on_leave avec retour dans le futur → on_leave', () => {
    const emp = {
      availability_status: 'on_leave',
      leave_start_date: '2026-09-20',
      leave_end_date: '2026-09-30',
    };
    assert.strictEqual(effectiveStatus(emp, day(2026, 9, 25)), 'on_leave');
  });

  it('effectiveStatus : on_leave dont la date de retour est aujourd\'hui → available', () => {
    const emp = {
      availability_status: 'on_leave',
      leave_start_date: '2026-09-20',
      leave_end_date: '2026-09-30',
    };
    // Le jour exact de retour (leave_end_date) = retour disponible.
    assert.strictEqual(effectiveStatus(emp, day(2026, 9, 30)), 'available');
    assert.strictEqual(effectiveStatus(emp, day(2026, 10, 1)), 'available');
  });

  it('effectiveStatus : on_leave dont la période commence dans le futur → available', () => {
    const emp = {
      availability_status: 'on_leave',
      leave_start_date: '2026-10-05',
      leave_end_date: '2026-10-10',
    };
    assert.strictEqual(effectiveStatus(emp, day(2026, 10, 1)), 'available');
  });

  it('isAssignable : on_leave non assigné ; available assigné', () => {
    const assignable = { availability_status: 'available' };
    const notAssignable = { availability_status: 'on_leave' };
    assert.strictEqual(isAssignable(assignable), true);
    assert.strictEqual(isAssignable(notAssignable), false);
  });

  it('isAssignable : absent non assigné ; offline non assigné', () => {
    assert.strictEqual(isAssignable({ availability_status: 'absent' }), false);
    assert.strictEqual(isAssignable({ availability_status: 'offline' }), false);
  });

  it('effectiveStatus : employee null → available', () => {
    assert.strictEqual(effectiveStatus(null), 'available');
  });

  it('autoRevertLeaves : met à jour les employees dont leave_end_date est passé', async () => {
    const fakeModel = createFakeModel();
    __setDeps({ models: { Employee: fakeModel } });
    await autoRevertLeaves(day(2026, 10, 1));
    assert.strictEqual(fakeModel.updates.length, 1);
    const { values, opts } = fakeModel.updates[0];
    assert.strictEqual(values.availability_status, 'available');
    assert.strictEqual(values.leave_start_date, null);
    assert.strictEqual(values.leave_end_date, null);
    assert.deepStrictEqual(opts.where.availability_status, 'on_leave');
  });

  it('toDayStr : formate les dates', () => {
    assert.strictEqual(toDayStr(new Date('2026-09-30T00:00:00')), '2026-09-30');
    assert.strictEqual(toDayStr('2026-09-30'), '2026-09-30');
    assert.strictEqual(toDayStr(null), null);
    assert.strictEqual(toDayStr(undefined), null);
  });
});
