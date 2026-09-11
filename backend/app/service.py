from copy import deepcopy
from fastapi import HTTPException
from .db_models import ProjectRecord, TemplateRecord, MinuteRecord, utcnow
from .repository import Repository


class Service:
    def __init__(self, session, model):
        self.session = session
        self.model = model
        self.repository = Repository(session, model)

    def get(self, record_id):
        record = self.repository.get(record_id)
        if record is None:
            raise HTTPException(404, f'{self.model.__tablename__} not found.')
        if self.model is not ProjectRecord:
            Service(self.session, ProjectRecord).get(record.project_id)
        return record

    def list(self, project_id=None):
        if project_id is not None:
            Service(self.session, ProjectRecord).get(project_id)
        return self.repository.list(project_id)

    def validate_template(self, project_id, template_id):
        if template_id is None:
            return
        template = Service(self.session, TemplateRecord).get(template_id)
        if template.project_id != project_id:
            raise HTTPException(422, 'Template must belong to the same project.')

    def create(self, payload, project_id=None):
        data = deepcopy(payload.model_dump())
        if project_id is not None:
            Service(self.session, ProjectRecord).get(project_id)
            data['project_id'] = project_id
        if self.model is MinuteRecord:
            self.validate_template(project_id, data.get('template_id'))
        return self.repository.add(data)

    def update(self, record_id, payload):
        record = self.get(record_id)
        data = deepcopy(payload.model_dump(exclude_unset=True))
        if self.model is MinuteRecord and 'template_id' in data:
            self.validate_template(record.project_id, data['template_id'])
        return self.repository.update(record, data)

    def delete(self, record_id):
        record = self.get(record_id)
        # Children remain as historical records; all access checks the live parent.
        self.repository.update(record, {'deleted_at': utcnow()})
