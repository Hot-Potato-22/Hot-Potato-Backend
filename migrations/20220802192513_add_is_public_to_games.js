/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.table('games',(table) => {
    table.string('hosted_by')
    table.boolean('is_public')
  })
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('games', (table) => {
    table.dropColumn('hosted_by');
    table.dropColumn('is_public');
  })
};
