#!/usr/bin/env node

/**
 * Migration script to convert legacy departments to better-auth teams
 * This script migrates from department-based config (v2.0) to team-based config (v3.0)
 */

import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

const CONFIG_PATH = path.join(
  process.cwd(),
  'analyses-storage/config/analyses-config.json',
);
const DB_PATH = path.join(process.cwd(), 'analyses-storage/auth.db');

async function migrateToTeams() {
  console.log('🚀 Starting migration from departments to teams...\n');

  try {
    // 1. Read current config
    console.log('📖 Reading current configuration...');
    const configData = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));

    if (configData.version === '3.0') {
      console.log('✅ Already migrated to v3.0 (team-based)');
      return;
    }

    if (!configData.departments) {
      console.log('⚠️  No departments found to migrate');
      configData.version = '3.0';
      await writeFile(CONFIG_PATH, JSON.stringify(configData, null, 2));
      console.log('✅ Updated to v3.0');
      return;
    }

    // 2. Get organization ID
    console.log('🔍 Finding main organization...');
    const db = new Database(DB_PATH);

    try {
      const org = db
        .prepare('SELECT id FROM organization WHERE slug = ?')
        .get('main');
      if (!org) {
        throw new Error('Main organization not found in better-auth database');
      }
      console.log(`✅ Found organization: ${org.id}`);

      // 3. Get or create uncategorized team
      console.log('🏗️  Setting up uncategorized team...');
      let uncategorizedTeam = db
        .prepare('SELECT id FROM team WHERE name = ? AND organizationId = ?')
        .get('Uncategorized', org.id);

      if (!uncategorizedTeam) {
        const uncategorizedTeamId = uuidv4();
        db.prepare(
          'INSERT INTO team (id, name, organizationId, createdAt, color, order_index, is_system) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).run(
          uncategorizedTeamId,
          'Uncategorized',
          org.id,
          new Date().toISOString(),
          '#9ca3af',
          0,
          1,
        );
        uncategorizedTeam = { id: uncategorizedTeamId };
        console.log(`✅ Created uncategorized team: ${uncategorizedTeamId}`);
      } else {
        console.log(
          `✅ Found existing uncategorized team: ${uncategorizedTeam.id}`,
        );
      }

      // 4. Create teams for departments
      console.log('🏭 Creating teams for departments...');
      const departmentToTeamMap = {
        uncategorized: uncategorizedTeam.id,
      };

      for (const [deptId, dept] of Object.entries(configData.departments)) {
        if (dept.isSystem) {
          console.log(`⏭️  Skipping system department: ${dept.name}`);
          continue;
        }

        // Check if team already exists
        const existingTeam = db
          .prepare('SELECT id FROM team WHERE id = ? AND organizationId = ?')
          .get(deptId, org.id);

        if (!existingTeam) {
          // Create team with same ID as department
          db.prepare(
            'INSERT INTO team (id, name, organizationId, createdAt) VALUES (?, ?, ?, ?)',
          ).run(deptId, dept.name, org.id, new Date().toISOString());
          console.log(`✅ Created team "${dept.name}" with ID: ${deptId}`);
        } else {
          console.log(`✅ Team "${dept.name}" already exists: ${deptId}`);
        }

        departmentToTeamMap[deptId] = deptId;
      }

      // 5. Update analyses to use teamId
      console.log('📝 Updating analyses to use team IDs...');
      if (configData.analyses) {
        for (const [analysisName, analysis] of Object.entries(
          configData.analyses,
        )) {
          if (analysis.department) {
            const teamId =
              departmentToTeamMap[analysis.department] || uncategorizedTeam.id;
            analysis.teamId = teamId;
            delete analysis.department;
            console.log(
              `✅ Migrated analysis "${analysisName}" to team: ${teamId}`,
            );
          }
        }
      }

      // 6. Update config structure
      console.log('🔧 Updating configuration structure...');
      delete configData.departments;
      configData.version = '3.0';

      // 7. Save updated config
      await writeFile(CONFIG_PATH, JSON.stringify(configData, null, 2));
      console.log('✅ Configuration saved');
    } finally {
      db.close();
    }

    console.log('\\n🎉 Migration completed successfully!');
    console.log('📊 Summary:');
    console.log(`   • Migrated to version: 3.0`);
    console.log(
      `   • Teams created: ${Object.keys(configData.analyses || {}).length > 0 ? 'Yes' : 'No'}`,
    );
    console.log(
      `   • Analyses updated: ${Object.keys(configData.analyses || {}).length}`,
    );
    console.log(
      '\\n✨ Your application now uses better-auth teams exclusively!',
    );
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateToTeams();
}

export { migrateToTeams };
