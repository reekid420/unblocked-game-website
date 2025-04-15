const prisma = require('./prisma');
const bcrypt = require('bcryptjs');

/**
 * Setup initial database with some default data
 */
async function setupDatabase() {
  try {
    console.log('Setting up database...');

    // Create admin user if it doesn't exist
    const adminExists = await prisma.user.findUnique({
      where: { username: 'admin' }
    });

    if (!adminExists) {
      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('admin123', salt);

      // Create admin user
      await prisma.user.create({
        data: {
          username: 'admin',
          passwordHash
        }
      });
      console.log('Admin user created');
    } else {
      console.log('Admin user already exists');
    }

    // Create default chat rooms if they don't exist
    const chatRooms = [
      { name: 'General Chat', description: 'General discussion for all topics' },
      { name: 'Math Help', description: 'Get help with math problems' },
      { name: 'Science Discussion', description: 'Discuss science topics and experiments' },
      { name: 'History Group', description: 'Talk about historical events and figures' },
      { name: 'Languages', description: 'Practice and learn different languages' }
    ];

    // Get admin user for relations
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' }
    });

    for (const room of chatRooms) {
      const existingRoom = await prisma.chat.findFirst({
        where: { name: room.name }
      });

      if (!existingRoom) {
        await prisma.chat.create({
          data: {
            name: room.name,
            description: room.description,
            participants: {
              connect: { id: admin.id }
            }
          }
        });
        console.log(`Created chat room: ${room.name}`);
      } else {
        console.log(`Chat room ${room.name} already exists`);
      }
    }

    console.log('Database setup complete!');
  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup if this file is executed directly
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase }; 