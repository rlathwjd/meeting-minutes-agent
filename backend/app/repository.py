from sqlalchemy import select


class Repository:
    def __init__(self, session, model):
        self.session = session
        self.model = model

    def get(self, record_id):
        return self.session.scalar(select(self.model).where(self.model.id == record_id, self.model.deleted_at.is_(None)))

    def list(self, project_id=None):
        statement = select(self.model).where(self.model.deleted_at.is_(None))
        if project_id is not None:
            statement = statement.where(self.model.project_id == project_id)
        return list(self.session.scalars(statement.order_by(self.model.created_at.desc(), self.model.id)))

    def add(self, data):
        record = self.model(**data)
        self.session.add(record)
        self.session.flush()
        return record

    def update(self, record, data):
        for name, value in data.items():
            setattr(record, name, value)
        self.session.flush()
        return record
