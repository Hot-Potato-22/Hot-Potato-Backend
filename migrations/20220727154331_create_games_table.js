/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('games', (table) => {
    table.increments('game_id', { primaryKey: true });
    table.integer('map_id').notNullable();
    table.foreign('map_id').references('map_id').inTable('maps');
    table.string('room_code').notNullable();
  })
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('games');
};
