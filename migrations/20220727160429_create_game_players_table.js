/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('gamePlayers', (table) => {
    table.integer('game_id').notNullable();
    table.foreign('game_id').references('game_id').inTable('games');
    table.integer('player_id').notNullable();
    table.foreign('player_id').references('player_id').inTable('players');
  })
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('gamePlayers');
};
