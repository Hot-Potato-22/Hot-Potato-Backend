/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('maps', (table) => {
    table.increments('map_id', { primaryKey: true });
    table.string('name').notNullable();
    table.string('img').notNullable();
  })
};

/**
 * @param { import("knex").Knex } knex
 * 
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('maps')
};
