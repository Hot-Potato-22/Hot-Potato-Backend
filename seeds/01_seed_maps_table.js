/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('maps').del()
  await knex('maps').insert([
    { map_id: 1, name: 'NYC' },
    { map_id: 2, name: 'FARM' },
    { map_id: 3, name: 'JUNGLE' }
  ]);
};
