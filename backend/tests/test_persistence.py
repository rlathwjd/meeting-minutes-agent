from pathlib import Path

import importlib

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import inspect, select
from sqlalchemy.orm import sessionmaker

from backend.app import database, migration
from backend.app.db_models import Base, ProjectRecord, TemplateRecord, MinuteRecord
from backend.app.api.v1.router import router


@pytest.fixture
def setup(tmp_path, monkeypatch):
    engine = database.build_engine(f'sqlite:///{(tmp_path / "test.db").as_posix()}')
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setattr(database, 'SessionLocal', factory)
    monkeypatch.setattr(migration, 'SessionLocal', factory)
    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        yield client, factory, engine
    engine.dispose()


def project(client, name='Project'):
    response = client.post('/api/v1/projects', json={'name': name, 'locations': ['회의실']})
    assert response.status_code == 201, response.text
    return response.json()


def template(client, project_id):
    response = client.post(f'/api/v1/projects/{project_id}/meeting-templates', json={'name': 'Template', 'template_data': {'sections': ['agenda']}})
    assert response.status_code == 201, response.text
    return response.json()


def minute(client, project_id, template_id=None):
    response = client.post(f'/api/v1/projects/{project_id}/meeting-minutes', json={'title': '회의록', 'template_id': template_id, 'content': {'sections': ['original'], 'decisions': ['승인']}})
    assert response.status_code == 201, response.text
    return response.json()


def test_crud_snapshot_and_disk_persistence(setup):
    client, factory, engine = setup
    p = project(client)
    t = template(client, p['id'])
    m = minute(client, p['id'], t['id'])
    assert p['status'] == 'active' and m['status'] == 'draft'
    assert t['is_default'] is False
    assert client.get(f"/api/v1/projects/{p['id']}").json()['template_ids'] == [t['id']]
    assert client.patch(f"/api/v1/meeting-templates/{t['id']}", json={'template_data': {'sections': ['changed']}}).status_code == 200
    assert client.get(f"/api/v1/meeting-minutes/{m['id']}").json()['content'] == m['content']
    edited = client.patch(f"/api/v1/meeting-minutes/{m['id']}", json={'title': '수정', 'status': 'completed', 'template_id': None}).json()
    assert edited['content'] == m['content'] and edited['template_id'] is None
    assert edited['updated_at'] > m['updated_at']
    assert client.patch(f"/api/v1/projects/{p['id']}", json={'name': 'Edited'}).json()['locations'] == ['회의실']
    # Dispose the pool and read through a new engine/session and a fresh HTTP client.
    url = str(engine.url)
    engine.dispose()
    restarted = database.build_engine(url)
    with sessionmaker(bind=restarted)() as db:
        assert db.get(MinuteRecord, m['id']).title == '수정'
        assert set(inspect(restarted).get_table_names()) == {'projects', 'meeting_templates', 'meeting_minutes'}
        assert db.connection().exec_driver_sql('PRAGMA foreign_keys').scalar() == 1
    restarted.dispose()
    with TestClient(client.app) as refreshed:
        assert refreshed.get(f"/api/v1/projects/{p['id']}/meeting-minutes").json()[0]['title'] == '수정'


def test_create_project_persists_to_database(setup):
    client, factory, _ = setup
    response = client.post('/api/v1/projects', json={'name': 'DB 적재 확인', 'description': 'insert test'})
    assert response.status_code == 201, response.text
    created = response.json()
    with factory() as db:
        record = db.get(ProjectRecord, created['id'])
        assert record is not None
        assert record.name == 'DB 적재 확인'
        assert record.description == 'insert test'
        assert record.deleted_at is None


def test_list_all_minutes_includes_project_and_template_names(setup):
    client, _, _ = setup
    p = project(client, 'Minutes Project')
    t = template(client, p['id'])
    m = minute(client, p['id'], t['id'])
    response = client.get('/api/v1/meeting-minutes')
    assert response.status_code == 200, response.text
    items = response.json()
    assert items[0]['id'] == m['id']
    assert items[0]['project_name'] == 'Minutes Project'
    assert items[0]['template_name'] == 'Template'
    assert items[0]['deleted_at'] is None
    client.delete(f"/api/v1/meeting-minutes/{m['id']}")
    assert client.get('/api/v1/meeting-minutes').json() == []


def test_soft_delete_parent_and_template(setup):
    client, factory, _ = setup
    p = project(client)
    t = template(client, p['id'])
    m = minute(client, p['id'], t['id'])
    assert client.delete(f"/api/v1/meeting-templates/{t['id']}").status_code == 204
    assert client.get(f"/api/v1/meeting-templates/{t['id']}").status_code == 404
    assert client.get(f"/api/v1/projects/{p['id']}/meeting-templates").json() == []
    assert client.get(f"/api/v1/meeting-minutes/{m['id']}").json()['content'] == m['content']
    assert client.patch(f"/api/v1/meeting-minutes/{m['id']}", json={'title': 'still editable'}).status_code == 200
    assert client.delete(f"/api/v1/projects/{p['id']}").status_code == 204
    assert client.get('/api/v1/projects').json() == []
    assert client.get(f"/api/v1/projects/{p['id']}/meeting-minutes").status_code == 404
    assert client.get(f"/api/v1/meeting-minutes/{m['id']}").status_code == 404
    with factory() as db:
        assert db.get(ProjectRecord, p['id']).deleted_at is not None
        assert db.get(MinuteRecord, m['id']).content == m['content']


def test_minute_delete(setup):
    client, factory, _ = setup
    p = project(client)
    m = minute(client, p['id'])
    assert client.delete(f"/api/v1/meeting-minutes/{m['id']}").status_code == 204
    assert client.get(f"/api/v1/meeting-minutes/{m['id']}").status_code == 404
    assert client.patch(f"/api/v1/meeting-minutes/{m['id']}", json={'title': 'x'}).status_code == 404
    with factory() as db:
        assert db.get(MinuteRecord, m['id']).deleted_at is not None


def test_relationship_errors(setup):
    client, _, _ = setup
    a, b = project(client), project(client, 'Other')
    t = template(client, a['id'])
    m = minute(client, b['id'])
    body = {'title': 'x', 'template_id': t['id'], 'content': {}}
    assert client.post(f"/api/v1/projects/{b['id']}/meeting-minutes", json=body).status_code == 422
    assert client.patch(f"/api/v1/meeting-minutes/{m['id']}", json={'template_id': t['id']}).status_code == 422
    assert client.post('/api/v1/projects/missing/meeting-minutes', json={'title': 'x', 'content': {}}).status_code == 404
    assert client.patch(f"/api/v1/meeting-minutes/{m['id']}", json={'template_id': 'missing'}).status_code == 404


@pytest.mark.parametrize('payload', [{'name': ''}, {'name': ' '}, {'name': 'x' * 201}, {'name': 'x', 'status': 'unknown'}])
def test_project_validation(setup, payload):
    assert setup[0].post('/api/v1/projects', json=payload).status_code == 422


@pytest.mark.parametrize('resource,field', [('projects', 'name'), ('projects', 'attendees'), ('projects', 'status'), ('meeting-templates', 'template_data'), ('meeting-templates', 'is_default'), ('meeting-minutes', 'content'), ('meeting-minutes', 'title')])
def test_patch_rejects_null_required(setup, resource, field):
    client, _, _ = setup
    p = project(client)
    t = template(client, p['id'])
    m = minute(client, p['id'])
    record = {'projects': p, 'meeting-templates': t, 'meeting-minutes': m}[resource]
    assert client.patch(f"/api/v1/{resource}/{record['id']}", json={field: None}).status_code == 422


def test_legacy_import_is_idempotent(setup, tmp_path, monkeypatch):
    import json
    client, factory, _ = setup
    p1 = '11111111-1111-4111-8111-111111111111'
    p2 = '22222222-2222-4222-8222-222222222222'
    t1 = '33333333-3333-4333-8333-333333333333'
    m1 = '44444444-4444-4444-8444-444444444444'
    records = {'PROJECTS_DB': [{'id': p1, 'name': 'Old', 'template_ids': [t1]}, {'id': p2, 'name': 'Other', 'template_ids': [t1]}],
               'TEMPLATES_DB': [{'id': t1, 'name': 'Old template', 'original_filename': 'a.doc', 'stored_filename': 't.doc', 'size': 1, 'content_type': 'application/msword'}],
               'DRAFTS_DB': [{'id': m1, 'template_id': t1, 'manual_title': 'Old minute'}]}
    for key, rows in records.items():
        path = tmp_path / key
        path.write_text(json.dumps(rows), encoding='utf-8')
        monkeypatch.setattr(migration, key, path)
    migration.migrate_legacy()
    client.delete(f'/api/v1/projects/{p1}')
    migration.migrate_legacy()
    with factory() as db:
        assert len(list(db.scalars(select(TemplateRecord)))) == 2
        assert db.get(ProjectRecord, p1).deleted_at is not None
        assert db.get(MinuteRecord, m1).content['input']['manual_title'] == 'Old minute'


def test_legacy_import_skips_orphan_drafts_without_project_fallback(setup, tmp_path, monkeypatch):
    import json
    client, factory, _ = setup
    records = {'PROJECTS_DB': [], 'TEMPLATES_DB': [], 'DRAFTS_DB': [{'id': '44444444-4444-4444-8444-444444444444', 'template_id': '33333333-3333-4333-8333-333333333333', 'manual_title': 'Old minute'}]}
    for key, rows in records.items():
        path = tmp_path / key
        path.write_text(json.dumps(rows), encoding='utf-8')
        monkeypatch.setattr(migration, key, path)
    migration.migrate_legacy()
    assert client.get('/api/v1/projects').json() == []
    with factory() as db:
        assert list(db.scalars(select(ProjectRecord))) == []
        assert list(db.scalars(select(MinuteRecord))) == []


def test_file_upload_and_generation_snapshot(setup, tmp_path, monkeypatch):
    from backend.app import main
    routes = importlib.import_module('backend.app.api.v1.meeting_templates')
    client, factory, _ = setup
    monkeypatch.setattr(routes, 'TEMPLATE_DIR', tmp_path)
    monkeypatch.setattr(main, 'TEMPLATE_DIR', tmp_path)
    monkeypatch.setattr(main, 'GENERATED_DIR', tmp_path)
    p = project(client)
    uploaded = client.post(f"/api/v1/projects/{p['id']}/meeting-templates/upload", data={'name': '파일 양식'}, files={'file': ('a.doc', b'fake doc')})
    assert uploaded.status_code == 201, uploaded.text
    t = uploaded.json()
    assert client.get(f"/api/v1/meeting-templates/{t['id']}/download").content == b'fake doc'
    def write_doc(_template, output, *_args):
        output.write_bytes(b'generated document')
    def write_pdf(_source, output):
        output.write_bytes(b'pdf')
    monkeypatch.setattr(main, 'generate_minutes_content', lambda *_: {'title': '한글 제목', 'decisions': ['독립 저장']})
    monkeypatch.setattr(main, 'generate_minutes_file', write_doc)
    monkeypatch.setattr(main, 'convert_doc_to_pdf', write_pdf)
    import json
    payload = {'template_id': t['id'], 'transcript_filename': 'a.txt', 'meeting_datetime': '2026-09-11T12:00:00+09:00', 'location': 'office', 'author': 'writer', 'meeting_type': 'in_person', 'title_mode': 'ai'}
    # Avoid startup table creation; reuse the isolated DB dependency.
    monkeypatch.setattr(main, 'init_db', lambda: None)
    with TestClient(main.app) as generated_client:
        response = generated_client.post('/api/minutes/generate', data={'project_id': p['id'], 'payload': json.dumps(payload)}, files={'transcript': ('a.txt', b'transcript')})
    assert response.status_code == 200, response.text
    saved = client.get('/api/v1/meeting-minutes/' + response.headers['x-minute-id']).json()
    assert saved['content']['minutes']['decisions'] == ['독립 저장']
    assert saved['status'] == 'completed' and saved['title'] == '한글 제목'
    assert saved['meeting_at'] == '2026-09-11T03:00:00Z'

@pytest.mark.parametrize('error_type,expected', [('integrity', 409), ('operational', 503)])
def test_database_errors_roll_back(setup, monkeypatch, error_type, expected):
    from sqlalchemy.exc import IntegrityError, OperationalError
    from backend.app.repository import Repository
    client, factory, _ = setup
    error_class = IntegrityError if error_type == 'integrity' else OperationalError
    def fail_after_add(repository, data):
        repository.session.add(ProjectRecord(**data))
        repository.session.flush()
        raise error_class('statement', {}, Exception('test failure'))
    monkeypatch.setattr(Repository, 'add', fail_after_add)
    response = client.post('/api/v1/projects', json={'name': 'Must roll back'})
    assert response.status_code == expected
    with factory() as db:
        assert list(db.scalars(select(ProjectRecord))) == []
