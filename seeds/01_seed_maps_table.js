/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('maps').del()
  await knex('maps').insert([
    { map_id: 1, name: 'NYC', img:'https://cdna.artstation.com/p/assets/images/images/024/979/396/large/sarath-kumar-nyc-street-day.jpg?1584168680'},
    { map_id: 2, name: 'FARM',img:'https://thumbs.dreamstime.com/b/farm-game-background-d-application-vector-design-tileable-horizontally-size-ready-parallax-effect-69534178.jpg' },
    { map_id: 3, name: 'JUNGLE',img:'https://www.to-be-education.com/images/Games/12687/3259a506890725f.jpg'}
  ]);
};
