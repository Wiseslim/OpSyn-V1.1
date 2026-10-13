"""Engineering module: Seed Product Catalog for Phase 3

Seeds initial product catalog with ~50 common products across categories:
- Labor: installation, testing, commissioning services
- Consumables: cable ties, labels, marking materials
- Equipment Rental: fusion splicer, OTDR, power meter
- Permits: right of way, excavation, utility crossing
- Services: surveying, testing, documentation

Revision ID: 0101
Revises: 0100
Create Date: 2026-10-09
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision      = '0101'
down_revision = '0100'
branch_labels = None
depends_on    = None


def upgrade() -> None:
    # Get all tenant IDs to seed products for each tenant
    conn = op.get_bind()
    result = conn.execute(sa.text("SELECT id FROM tenants"))
    tenant_ids = [str(row[0]) for row in result]

    if not tenant_ids:
        print("No tenants found - skipping product catalog seed")
        return

    # Define product catalog
    products = [
        # LABOR CATEGORY
        {
            'code': 'LAB-001',
            'name': 'Fiber Cable Installation - Aerial',
            'category': 'labor',
            'unit': 'meter',
            'cost': 2.50,
            'description': 'Labor cost for aerial fiber cable installation including stringing and securing',
            'supplier': None,
            'lead_time': 0,
        },
        {
            'code': 'LAB-002',
            'name': 'Fiber Cable Installation - Underground',
            'category': 'labor',
            'unit': 'meter',
            'cost': 5.00,
            'description': 'Labor cost for underground fiber cable installation including trenching and backfill',
            'supplier': None,
            'lead_time': 0,
        },
        {
            'code': 'LAB-003',
            'name': 'Fiber Splicing - Fusion',
            'category': 'labor',
            'unit': 'splice',
            'cost': 15.00,
            'description': 'Labor cost per fusion splice including testing and documentation',
            'supplier': None,
            'lead_time': 0,
        },
        {
            'code': 'LAB-004',
            'name': 'FDT Installation and Commissioning',
            'category': 'labor',
            'unit': 'unit',
            'cost': 150.00,
            'description': 'Labor for FDT cabinet installation, fiber termination, and testing',
            'supplier': None,
            'lead_time': 0,
        },
        {
            'code': 'LAB-005',
            'name': 'FAT Installation',
            'category': 'labor',
            'unit': 'unit',
            'cost': 80.00,
            'description': 'Labor for FAT box installation and fiber distribution',
            'supplier': None,
            'lead_time': 0,
        },
        {
            'code': 'LAB-006',
            'name': 'OLT Installation and Configuration',
            'category': 'labor',
            'unit': 'unit',
            'cost': 500.00,
            'description': 'Labor for OLT installation, rack mounting, and configuration',
            'supplier': None,
            'lead_time': 0,
        },
        {
            'code': 'LAB-007',
            'name': 'Pole Installation',
            'category': 'labor',
            'unit': 'unit',
            'cost': 300.00,
            'description': 'Labor for utility pole installation including foundation',
            'supplier': None,
            'lead_time': 0,
        },
        {
            'code': 'LAB-008',
            'name': 'Network Testing and Commissioning',
            'category': 'labor',
            'unit': 'hour',
            'cost': 75.00,
            'description': 'Hourly rate for network testing, OTDR testing, and commissioning',
            'supplier': None,
            'lead_time': 0,
        },
        {
            'code': 'LAB-009',
            'name': 'Customer Drop Installation',
            'category': 'labor',
            'unit': 'unit',
            'cost': 120.00,
            'description': 'Labor for customer drop cable installation and ONT setup',
            'supplier': None,
            'lead_time': 0,
        },
        {
            'code': 'LAB-010',
            'name': 'Splitter Installation',
            'category': 'labor',
            'unit': 'unit',
            'cost': 50.00,
            'description': 'Labor for optical splitter installation and testing',
            'supplier': None,
            'lead_time': 0,
        },

        # CONSUMABLES CATEGORY
        {
            'code': 'CON-001',
            'name': 'Cable Ties - UV Resistant',
            'category': 'consumable',
            'unit': 'pack',
            'cost': 12.00,
            'description': 'Pack of 100 UV-resistant cable ties for outdoor cable management',
            'supplier': 'General Supply Co',
            'lead_time': 3,
        },
        {
            'code': 'CON-002',
            'name': 'Fiber Marking Labels',
            'category': 'consumable',
            'unit': 'roll',
            'cost': 25.00,
            'description': 'Roll of 500 fiber identification labels',
            'supplier': 'General Supply Co',
            'lead_time': 3,
        },
        {
            'code': 'CON-003',
            'name': 'Cable Marker Tags',
            'category': 'consumable',
            'unit': 'pack',
            'cost': 15.00,
            'description': 'Pack of 100 cable marker tags for route identification',
            'supplier': 'General Supply Co',
            'lead_time': 3,
        },
        {
            'code': 'CON-004',
            'name': 'Splice Protection Sleeves',
            'category': 'consumable',
            'unit': 'pack',
            'cost': 45.00,
            'description': 'Pack of 100 heat shrink splice protection sleeves',
            'supplier': 'Fiber Supply Inc',
            'lead_time': 5,
        },
        {
            'code': 'CON-005',
            'name': 'Cleaning Supplies - Fiber',
            'category': 'consumable',
            'unit': 'kit',
            'cost': 75.00,
            'description': 'Fiber optic cleaning kit with wipes, swabs, and cleaning solution',
            'supplier': 'Fiber Supply Inc',
            'lead_time': 5,
        },
        {
            'code': 'CON-006',
            'name': 'Cable Lashing Wire',
            'category': 'consumable',
            'unit': 'roll',
            'cost': 120.00,
            'description': '1000m roll of stainless steel lashing wire for aerial cable',
            'supplier': 'General Supply Co',
            'lead_time': 7,
        },
        {
            'code': 'CON-007',
            'name': 'Grounding Kit',
            'category': 'consumable',
            'unit': 'kit',
            'cost': 85.00,
            'description': 'Grounding kit for cabinet/enclosure installation',
            'supplier': 'General Supply Co',
            'lead_time': 5,
        },
        {
            'code': 'CON-008',
            'name': 'Warning Tape - Fiber Optic Cable',
            'category': 'consumable',
            'unit': 'roll',
            'cost': 30.00,
            'description': '500m roll of underground warning tape',
            'supplier': 'General Supply Co',
            'lead_time': 3,
        },
        {
            'code': 'CON-009',
            'name': 'Conduit Lubricant',
            'category': 'consumable',
            'unit': 'gallon',
            'cost': 45.00,
            'description': 'Cable pulling lubricant for conduit installation',
            'supplier': 'General Supply Co',
            'lead_time': 3,
        },
        {
            'code': 'CON-010',
            'name': 'Silicone Sealant',
            'category': 'consumable',
            'unit': 'tube',
            'cost': 8.00,
            'description': 'Waterproof silicone sealant for enclosure sealing',
            'supplier': 'General Supply Co',
            'lead_time': 1,
        },

        # EQUIPMENT RENTAL CATEGORY
        {
            'code': 'EQR-001',
            'name': 'Fusion Splicer Rental',
            'category': 'equipment_rental',
            'unit': 'day',
            'cost': 250.00,
            'description': 'Daily rental of fusion splicing machine with cleaver',
            'supplier': 'Equipment Rental Co',
            'lead_time': 7,
        },
        {
            'code': 'EQR-002',
            'name': 'OTDR Rental',
            'category': 'equipment_rental',
            'unit': 'day',
            'cost': 180.00,
            'description': 'Daily rental of Optical Time Domain Reflectometer for testing',
            'supplier': 'Equipment Rental Co',
            'lead_time': 7,
        },
        {
            'code': 'EQR-003',
            'name': 'Power Meter and Light Source Rental',
            'category': 'equipment_rental',
            'unit': 'day',
            'cost': 75.00,
            'description': 'Daily rental of optical power meter and light source set',
            'supplier': 'Equipment Rental Co',
            'lead_time': 5,
        },
        {
            'code': 'EQR-004',
            'name': 'Cable Pulling Equipment',
            'category': 'equipment_rental',
            'unit': 'day',
            'cost': 120.00,
            'description': 'Daily rental of cable pulling winch and accessories',
            'supplier': 'Equipment Rental Co',
            'lead_time': 3,
        },
        {
            'code': 'EQR-005',
            'name': 'Trencher Rental - Walk Behind',
            'category': 'equipment_rental',
            'unit': 'day',
            'cost': 200.00,
            'description': 'Daily rental of walk-behind trenching machine',
            'supplier': 'Equipment Rental Co',
            'lead_time': 5,
        },
        {
            'code': 'EQR-006',
            'name': 'Bucket Truck Rental',
            'category': 'equipment_rental',
            'unit': 'day',
            'cost': 450.00,
            'description': 'Daily rental of bucket truck for aerial work',
            'supplier': 'Equipment Rental Co',
            'lead_time': 10,
        },
        {
            'code': 'EQR-007',
            'name': 'Directional Drill Rental',
            'category': 'equipment_rental',
            'unit': 'day',
            'cost': 800.00,
            'description': 'Daily rental of horizontal directional drill for underground cable',
            'supplier': 'Equipment Rental Co',
            'lead_time': 14,
        },
        {
            'code': 'EQR-008',
            'name': 'Generator Rental - 10kW',
            'category': 'equipment_rental',
            'unit': 'day',
            'cost': 150.00,
            'description': 'Daily rental of 10kW portable generator',
            'supplier': 'Equipment Rental Co',
            'lead_time': 3,
        },
        {
            'code': 'EQR-009',
            'name': 'Cable Locator Equipment',
            'category': 'equipment_rental',
            'unit': 'day',
            'cost': 80.00,
            'description': 'Daily rental of underground utility locator',
            'supplier': 'Equipment Rental Co',
            'lead_time': 3,
        },
        {
            'code': 'EQR-010',
            'name': 'Vacuum Excavator Rental',
            'category': 'equipment_rental',
            'unit': 'day',
            'cost': 350.00,
            'description': 'Daily rental of vacuum excavation truck',
            'supplier': 'Equipment Rental Co',
            'lead_time': 7,
        },

        # PERMIT CATEGORY
        {
            'code': 'PER-001',
            'name': 'Right of Way Permit',
            'category': 'permit',
            'unit': 'permit',
            'cost': 500.00,
            'description': 'Right of way permit for public land fiber installation',
            'supplier': None,
            'lead_time': 30,
        },
        {
            'code': 'PER-002',
            'name': 'Excavation Permit',
            'category': 'permit',
            'unit': 'permit',
            'cost': 250.00,
            'description': 'Permit for excavation and trenching work',
            'supplier': None,
            'lead_time': 14,
        },
        {
            'code': 'PER-003',
            'name': 'Utility Crossing Permit',
            'category': 'permit',
            'unit': 'permit',
            'cost': 750.00,
            'description': 'Permit for crossing roads or utility corridors',
            'supplier': None,
            'lead_time': 45,
        },
        {
            'code': 'PER-004',
            'name': 'Aerial Attachment Permit',
            'category': 'permit',
            'unit': 'permit',
            'cost': 300.00,
            'description': 'Permit for attaching fiber to utility poles',
            'supplier': None,
            'lead_time': 21,
        },
        {
            'code': 'PER-005',
            'name': 'Traffic Control Permit',
            'category': 'permit',
            'unit': 'permit',
            'cost': 150.00,
            'description': 'Permit for temporary traffic control during construction',
            'supplier': None,
            'lead_time': 7,
        },
        {
            'code': 'PER-006',
            'name': 'Environmental Impact Assessment',
            'category': 'permit',
            'unit': 'assessment',
            'cost': 2000.00,
            'description': 'Environmental impact assessment for major route construction',
            'supplier': 'Environmental Consultants Inc',
            'lead_time': 60,
        },
        {
            'code': 'PER-007',
            'name': 'Building Entry Permit',
            'category': 'permit',
            'unit': 'permit',
            'cost': 100.00,
            'description': 'Permit for fiber entry into commercial buildings',
            'supplier': None,
            'lead_time': 10,
        },
        {
            'code': 'PER-008',
            'name': 'Tree Trimming Permit',
            'category': 'permit',
            'unit': 'permit',
            'cost': 200.00,
            'description': 'Permit for trimming trees along fiber route',
            'supplier': None,
            'lead_time': 14,
        },

        # SERVICE CATEGORY
        {
            'code': 'SRV-001',
            'name': 'Topographic Survey',
            'category': 'service',
            'unit': 'km',
            'cost': 500.00,
            'description': 'Professional topographic survey per kilometer',
            'supplier': 'Survey Solutions Ltd',
            'lead_time': 14,
        },
        {
            'code': 'SRV-002',
            'name': 'Utility Locate Service',
            'category': 'service',
            'unit': 'km',
            'cost': 200.00,
            'description': 'Professional utility location service per kilometer',
            'supplier': 'Survey Solutions Ltd',
            'lead_time': 7,
        },
        {
            'code': 'SRV-003',
            'name': 'Engineering Design Review',
            'category': 'service',
            'unit': 'hour',
            'cost': 150.00,
            'description': 'Professional engineering design review and certification',
            'supplier': 'Engineering Consultants Inc',
            'lead_time': 7,
        },
        {
            'code': 'SRV-004',
            'name': 'Network Testing Certification',
            'category': 'service',
            'unit': 'site',
            'cost': 800.00,
            'description': 'Third-party network testing and certification per site',
            'supplier': 'Testing Services Co',
            'lead_time': 14,
        },
        {
            'code': 'SRV-005',
            'name': 'As-Built Documentation',
            'category': 'service',
            'unit': 'km',
            'cost': 300.00,
            'description': 'Professional as-built documentation preparation per kilometer',
            'supplier': 'Documentation Services Ltd',
            'lead_time': 10,
        },
        {
            'code': 'SRV-006',
            'name': 'Project Management',
            'category': 'service',
            'unit': 'month',
            'cost': 8000.00,
            'description': 'Monthly project management services',
            'supplier': None,
            'lead_time': 0,
        },
        {
            'code': 'SRV-007',
            'name': 'Quality Assurance Inspection',
            'category': 'service',
            'unit': 'inspection',
            'cost': 400.00,
            'description': 'Independent QA inspection of completed work',
            'supplier': 'QA Services Inc',
            'lead_time': 7,
        },
        {
            'code': 'SRV-008',
            'name': 'Training - Fiber Splicing',
            'category': 'service',
            'unit': 'person',
            'cost': 1200.00,
            'description': 'Professional fiber splicing training per person',
            'supplier': 'Training Academy',
            'lead_time': 30,
        },
        {
            'code': 'SRV-009',
            'name': 'Network Design Services',
            'category': 'service',
            'unit': 'project',
            'cost': 5000.00,
            'description': 'Professional network design services per project',
            'supplier': 'Network Design Co',
            'lead_time': 21,
        },
        {
            'code': 'SRV-010',
            'name': 'Environmental Monitoring',
            'category': 'service',
            'unit': 'month',
            'cost': 1500.00,
            'description': 'Monthly environmental compliance monitoring',
            'supplier': 'Environmental Consultants Inc',
            'lead_time': 7,
        },
    ]

    # Insert products for each tenant
    for tenant_id in tenant_ids:
        for product in products:
            conn.execute(sa.text("""
                INSERT INTO products (
                    tenant_id, product_code, product_name, category, description,
                    unit, standard_cost, supplier, lead_time_days, is_active
                ) VALUES (
                    :tenant_id, :code, :name, :category, :description,
                    :unit, :cost, :supplier, :lead_time, true
                )
            """), {
                'tenant_id': tenant_id,
                'code': product['code'],
                'name': product['name'],
                'category': product['category'],
                'description': product['description'],
                'unit': product['unit'],
                'cost': product['cost'],
                'supplier': product['supplier'],
                'lead_time': product['lead_time'],
            })

    print(f"Seeded {len(products)} products for {len(tenant_ids)} tenant(s)")


def downgrade() -> None:
    # Delete all seeded products (by product codes)
    product_codes = [
        'LAB-001', 'LAB-002', 'LAB-003', 'LAB-004', 'LAB-005', 'LAB-006', 'LAB-007', 'LAB-008', 'LAB-009', 'LAB-010',
        'CON-001', 'CON-002', 'CON-003', 'CON-004', 'CON-005', 'CON-006', 'CON-007', 'CON-008', 'CON-009', 'CON-010',
        'EQR-001', 'EQR-002', 'EQR-003', 'EQR-004', 'EQR-005', 'EQR-006', 'EQR-007', 'EQR-008', 'EQR-009', 'EQR-010',
        'PER-001', 'PER-002', 'PER-003', 'PER-004', 'PER-005', 'PER-006', 'PER-007', 'PER-008',
        'SRV-001', 'SRV-002', 'SRV-003', 'SRV-004', 'SRV-005', 'SRV-006', 'SRV-007', 'SRV-008', 'SRV-009', 'SRV-010',
    ]

    codes_str = "', '".join(product_codes)
    op.execute(sa.text(f"DELETE FROM products WHERE product_code IN ('{codes_str}')"))
