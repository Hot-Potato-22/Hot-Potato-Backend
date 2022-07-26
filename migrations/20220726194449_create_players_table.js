/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('players', (table) => {
    table.increments('player_id', { primaryKey: true });
    table.string('username', 20).notNullable();
    table.string('password').notNullable();
    table.string('pfp_link', 600);
    table.integer('games_won').defaultTo(0)
    table.integer('games_lost').defaultTo(0)
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('players')
};
